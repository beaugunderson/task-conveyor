'use strict';

var atob = require('atob');
var express = require('express');
var moment = require('moment');
var request = require('request');
var _ = require('lodash');

var UTC_FORMAT = 'ddd D MMM YYYY HH:mm:ss Z';

var app = express();

app.use(express.static('static'));

app.get('/', (req, res) => {
  res.send('hello world');
});

function countLabels(data) {
  function name(id) {
    return _.find(data.labels, (label) => label.id === id).name;
  }

  return _(data.items)
    .map('labels')
    .flatten()
    .map(name)
    .countBy()
    .map((count, label) => ({name: label, count: count}))
    .sortBy((label) => -label.count);
}

function countProjects(data) {
  function name(id) {
    return _.find(data.projects, (project) => project.id === id).name;
  }

  return _(data.items)
    .map('project_id')
    .map(name)
    .countBy()
    .map((count, project) => ({name: project, count: count}))
    .sortBy((project) => -project.count);
}

function getInbox(data) {
  return _.find(data.projects, (project) => project.inbox_project === true).id;
}

function getInboxTasks(data) {
  var inboxId = getInbox(data);

  return _.filter(data.items, (item) => item.project_id === inboxId);
}

function taskIsOverdue(now, todayStart, todayEnd, task) {
  var dueDate = moment(task.due_date_utc, UTC_FORMAT);

  return dueDate.isBefore(now) ||
         dueDate.isBetween(todayStart, todayEnd);
}

function getOverdueTasks(data) {
  var now = moment();

  var todayStart = now.startOf('day');
  var todayEnd = now.endOf('day');

  return data.items.filter(_.partial(taskIsOverdue, now, todayStart, todayEnd));
}

app.get('/tweet/:url', (req, res) => {
  request.get({
    url: 'https://api.twitter.com/1/statuses/oembed.json',
    qs: {
      url: atob(req.params.url),
      align: 'center'
    },
    json: true
  }, function (err, response, body) {
    res.status(200).json(body);
  });
});

app.get('/unshorten/:url', (req, res) => {
  request({
    method: 'HEAD',
    url: atob(req.params.url),
    followAllRedirects: true
  },
  (err, response) => {
    res.status(200).json(response.request.href);
  });
});

app.get('/tasks/', (req, res) => {
  request.get({
    url: 'https://todoist.com/API/v7/sync',
    form: {
      token: process.env.TODOIST_BEAU_TEST_TOKEN,
      sync_token: '*',
      resource_types: '["filters", "items", "labels", "projects", "user"]'
    },
    json: true
  },
  (err, response, body) => {
    // we only want 'live' tasks
    body.items = body.items.filter((item) =>
                                   item.checked !== 1 &&
                                   item.in_history !== 1 &&
                                   item.is_deleted !== 1 &&
                                   item.is_archived !== 1);

    res.status(200).json({
      labelCounts: countLabels(body),
      projectCounts: countProjects(body),
      inbox: getInboxTasks(body),
      overdue: getOverdueTasks(body),
      todoist: {
        items: body.items,
        labels: body.labels,
        user: body.user,
        filters: body.filters,
        projects: body.projects
      }
    });
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Listening on port ${process.env.PORT}`);
});
