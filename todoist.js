'use strict';

const moment = require('moment');
const _ = require('lodash');

const TODOIST_UTC_FORMAT = 'ddd D MMM YYYY HH:mm:ss Z';

function name(data) {
  return function(id) {
    const found = _.find(data.labels, (label) => label.id === id);

    if (!found) {
      return 'UNKNOWN';
    }

    return found.name;
  };
}

function countLabels(data) {
  return _(data.items)
    .map('labels')
    .flatten()
    .map(name(data))
    .countBy()
    .map((count, label) => ({name: label, count: count}))
    .sortBy((label) => -label.count);
}

function activeLabels(data) {
  return _(data.items)
    .map('labels')
    .flatten()
    .map(name(data))
    .uniq()
    .value();
}

function allLabels(data) {
  return _.map(data.labels, 'name');
}

const unusedLabels = exports.unusedLabels = (data) => {
  function labelFromName(name) {
    return _.find(data.labels, (label) => label.name === name);
  }

  const names = _.difference(allLabels(data), activeLabels(data));

  return _.map(names, labelFromName);
};

function countProjects(data) {
  function projectName(id) {
    const project = _.find(data.projects, (p) => p.id === id);

    if (project) {
      return project.name;
    }
  }

  return _(data.items)
    .map('project_id')
    .map(projectName)
    .countBy()
    .map((count, project) => ({name: project, count: count}))
    .sortBy((project) => -project.count);
}

function getInbox(data) {
  return _.find(data.projects, (project) => project.inbox_project === true).id;
}

const getInboxTasks = exports.getInboxTasks = (data) => {
  const inboxId = getInbox(data);

  return _.filter(data.items, (item) => item.project_id === inboxId);
};

function taskIsOverdue(now, todayStart, todayEnd, task) {
  const dueDate = moment(task.due_date_utc, TODOIST_UTC_FORMAT);

  return dueDate.isBefore(now) ||
         dueDate.isBetween(todayStart, todayEnd);
}

const getOverdueTasks = exports.getOverdueTasks = (data) => {
  const now = moment();

  const todayStart = now.startOf('day');
  const todayEnd = now.endOf('day');

  return data.items.filter(_.partial(taskIsOverdue, now, todayStart, todayEnd));
};

const onlyActive = exports.onlyActive = (items) => {
  return items.filter((item) =>
    item.checked !== 1 &&
                      item.in_history !== 1 &&
                      item.is_deleted !== 1 &&
                      item.is_archived !== 1);
};

exports.formatAll = (data) => {
  data.items = onlyActive(data.items);

  return {
    labelCounts: countLabels(data),
    projectCounts: countProjects(data),
    inbox: getInboxTasks(data),
    overdue: getOverdueTasks(data),
    unusedLabels: unusedLabels(data),
    todoist: {
      items: data.items,
      labels: data.labels,
      user: data.user,
      filters: data.filters,
      projects: data.projects
    }
  };
};
