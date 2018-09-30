'use strict';

const atob = require('atob');
const bodyParser = require('body-parser');
const cacheManager = require('cache-manager');
const express = require('express');
const Grant = require('grant-express');
const logger = require('morgan');
const nunjucks = require('nunjucks');
const redisCacheStore = require('cache-manager-redis');
const request = require('request');
const session = require('express-session');
const todoist = require('./todoist.js');
const uuid = require('uuid/v4');

const RedisStore = require('connect-redis')(session);

const redisCache = cacheManager.caching({
  store: redisCacheStore,
  host: 'redis',
  db: 1,
  ttl: 60 * 60
});

redisCache.store.events.on('redisError', (error) => console.log(error));

const PRODUCTION = process.env === 'production';

const grant = new Grant({
  server: {
    protocol: 'http',
    host: 'lvh.me:10071'
  },
  todoist: {
    key: process.env.TODOIST_CLIENT_ID,
    secret: process.env.TODOIST_CLIENT_SECRET,
    callback: '/todoist-callback/',
    scope: [
      'data:read_write',
      'data:delete',
      'project:delete'
    ]
  }
});

const app = express();

nunjucks.configure('views', {
  autoescape: true,
  express: app,
  throwOnUndefined: true,
  watch: !PRODUCTION
});

app.use(logger('dev'));

app.use(session({
  name: 'task-conveyor',
  saveUninitialized: false,
  resave: false,
  secret: process.env.SESSION_SECRET,
  store: new RedisStore({
    url: 'redis://redis/0',
    logErrors: true
  })
}));

app.use(grant);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use('/semantic', express.static(__dirname + '/node_modules/semantic-ui-css/'));
app.use(express.static('static'));

function secure(req, res, next) {
  if (!req.session || !req.session.todoistToken) {
    return res.status(500).send('UNAUTHORIZED');
  }

  next();
}

app.get('/', (req, res) => {
  if (!req.session || !req.session.todoistToken) {
    return res.render('logged-out.html');
  }

  res.render('dashboard.html');
});

app.get('/todoist-callback/', (req, res) => {
  req.session.todoistToken = req.query.access_token;
  res.redirect('/');
});

app.get('/logout/', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

function cachedEmbed(url, cb) {
  redisCache.wrap(url, (cacheCb) => {
    request.get({
      url: 'https://api.twitter.com/1/statuses/oembed.json',
      qs: {
        url: atob(url),
        align: 'center',
        omit_script: 'true'
      },
      json: true
    },
    (err, response, body) => cacheCb(err, body));
  }, {ttl: 24 * 60 * 60}, cb);
}

app.get('/tweet/:url', (req, res) => {
  cachedEmbed(req.params.url, (err, tweet) => {
    res.status(200).json(tweet);
  });
});

function cachedUnshorten(url, cb) {
  redisCache.wrap(url, (cacheCb) => {
    request({
      method: 'HEAD',
      url: atob(url),
      followAllRedirects: true
    },
    (err, response) => cacheCb(err, response.request.href));
  }, {ttl: 24 * 60 * 60}, cb);
}

app.get('/unshorten/:url', (req, res) => {
  cachedUnshorten(req.params.url, (err, url) => {
    res.status(200).json(url);
  });
});

app.post('/tasks/edit/', secure, (req, res) => {
  res.status(200);
});

function getTasks(token, cb) {
  request.post({
    url: 'https://todoist.com/API/v7/sync',
    form: {
      token: token,
      sync_token: '*',
      resource_types: '["filters", "items", "labels", "projects", "user"]'
    },
    json: true
  },
  (err, response, body) => {
    // pre-filter to only active items
    body.items = todoist.onlyActive(body.items);

    cb(err, body);
  });
}

function getCachedTasks(token, cb) {
  redisCache.wrap(token, (cacheCb) => {
    getTasks(token, cacheCb);
  }, {ttl: 60 * 60}, cb);
}

function invalidateTasks(token, cb) {
  redisCache.del(token, cb);
}

function tasksMiddleware(req, res, next) {
  getCachedTasks(req.session.todoistToken, (err, data) => {
    if (err) {
      return res.status(500).send(err);
    }

    req.tasks = data;

    next();
  });
}

app.get('/overdue-tasks/', secure, tasksMiddleware, (req, res) => {
  res.render('unused-labels.html', {
    overdue: todoist.getOverdueTasks(req.tasks),
  });
});

app.get('/inbox/', secure, tasksMiddleware, (req, res) => {
  res.render('unused-labels.html', {
    inbox: todoist.getInboxTasks(req.tasks),
  });
});

app.get('/unused-labels/', secure, tasksMiddleware, (req, res) => {
  res.render('unused-labels.html', {
    labels: todoist.unusedLabels(req.tasks),
  });
});

function deleteLabels(token, labels, cb) {
  var commands = labels.map((label) => {
    return {
      type: 'label_delete',
      uuid: uuid(),
      args: {id: parseInt(label, 10)}
    };
  });

  request.post({
    url: 'https://todoist.com/API/v7/sync',
    form: {
      token: token,
      commands: JSON.stringify(commands),
    },
    json: true,
  },
  (err, response, body) => cb(err, body));
}

app.post('/unused-labels/', secure, (req, res) => {
  const labels = Array.isArray(req.body.labels) ?
    req.body.labels :
    [req.body.labels];

  deleteLabels(req.session.todoistToken, labels, () => {
    invalidateTasks(req.session.todoistToken, () => res.redirect('/'));
  });
});

app.get('/tasks/', secure, tasksMiddleware, (req, res) => {
  res.status(200).json(todoist.formatAll(req.tasks));
});

app.listen(process.env.PORT, () => {
  console.log(`Listening on port ${process.env.PORT}`);
});
