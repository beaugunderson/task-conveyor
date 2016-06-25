/*globals $:true Mousetrap:true*/

'use strict';

var counter = 0;
var userData;

function parseContent(content, cb) {
  var tweet = content.match(/^https?:\/\/twitter.com\/[a-z0-9_]+\/status\/\d+/i);

  if (tweet) {
    $('#current-task').html(content);

    $.getJSON('/tweet/' + btoa(tweet), function (data) {
      cb(null, data.html, {tweet: true});
    });

    return;
  }

  cb(null, content.replace(/(https?:\/\/[^ ]+) \(([^\(\)]+)\)/g, '<a href="$1">$2</a>'), {});
}

function updateItem(item) {
  parseContent(item.content, function (err, content, metadata) {
    if (content.indexOf('t.co/') === -1 || metadata.tweet === true) {
      $('#current-task').html(content);

      return;
    }

    $('#current-task').html(content);

    var url = content.match(/https?:\/\/t.co([^ ”<>\b]+|$)/);

    unshorten(url[0], function (unshortenError, unshortened) {
      content = content.replace(url[0], unshortened);

      $('#current-task').html(content);
    });
  });
}

function unshorten(url, cb) {
  $.getJSON('/unshorten/' + btoa(url), function (data) {
    cb(null, data);
  });
}

$(function () {
  $.getJSON('/tasks/', function (data) {
    userData = data;

    $('#loading').hide();

    data.projectCounts.forEach(function (project) {
      $('#projects').append('<li class="tag is-small is-primary">' +
                            '<a href="#">' +
                            project.name +
                            '</a>' +
                            '</li>');
    });

    data.labelCounts.forEach(function (label) {
      $('#labels').append('<li class="tag is-small is-info">' +
                          '<a href="#">' +
                          label.name +
                          '</a>' +
                          '</li>');
    });

    updateItem(data.todoist.items[0]);
  });

  Mousetrap.bind('enter', function () {
    updateItem(userData.todoist.items[++counter]);

    return false;
  });
});
