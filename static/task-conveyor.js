// @flow

/* globals twttr:true */

import 'semantic-ui-css/semantic.min.css';
import './task-conveyor.scss';

import Mousetrap from 'mousetrap';
import React from 'react';
import ReactDOM from 'react-dom';
import urlRegex from 'url-regex';
import XRegExp from 'xregexp';
import { BrowserRouter } from 'react-router-dom';
import { Button, Grid, Header, Label, Menu, Progress, Segment } from 'semantic-ui-react';

const RE_MARKUP_LINK = XRegExp(`(?<href>https?://[^ ]+)\\s+\\((?<title>[^()]+)\\)`);
const RE_TWEET = /^https?:\/\/twitter.com\/[a-z0-9_]+\/status\/\d+/i;
const RE_URL = /https?:\/\/(t\.co|bit\.ly|tinyurl\.com)([^ ”<>\b]+|$)/;

const PROJECT_COLORS = [
  '#95ef63',
  '#ff8581',
  '#ffc471',
  '#f9ec75',
  '#a8c8e4',
  '#d2b8a3',
  '#e2a8e4',
  '#cccccc',
  '#fb886e',
  '#ffcc00',
  '#74e8d3',
  '#3bd5fb',
  '#dc4fad',
  '#ac193d',
  '#d24726',
  '#82ba00',
  '#03b3b2',
  '#008299',
  '#5db2ff',
  '#0072c6',
  '#000000',
  '#777777'
];

const LABEL_COLORS = [
  '#019412',
  '#a39d01',
  '#e73d02',
  '#e702a4',
  '#9902e7',
  '#1d02e7',
  '#0082c5',
  '#555555',
  '#008299',
  '#03b3b2',
  '#ac193d',
  '#82ba00',
  '#111111'
];

function fixUrl(url) {
  if (!url.match(/:\/\//)) {
    return `https://${url}`;
  }

  return url;
}

async function parseContent(content) {
  let match;

  if ((match = content.match(RE_TWEET))) {
    const response = await fetch(`/tweet/${btoa(match)}`);

    return response.json();
  }

  // first check for markdown-style links
  if ((match = XRegExp.exec(content, RE_MARKUP_LINK))) {
    return `<a href=${fixUrl(match.href)}>${match.title}</a>`;
  }

  // then linkify bare URLs
  return content.replace(urlRegex({ strict: false }), url => `<a href=${fixUrl(url)}>${url}</a>`);
}

async function unshorten(url) {
  const response = await fetch(`/unshorten/${btoa(url)}`);

  return response.json();
}

async function itemContent(item) {
  const content = (await parseContent(item.content)) || item.content;

  if (content.errors) {
    return item.content;
  }

  if (content.html) {
    return content.html;
  }

  const url = content.match(RE_URL);

  if (!url) {
    return content;
  }

  const unshortened = await unshorten(url[0]);

  return content.replace(url[0], unshortened);
}

type TaskProps = {
  labels: Array<{ name: string }>,
  project: {
    name: string,
    color: string
  },
  task: {
    content: string
  }
};

type TaskState = {
  content: ?string
};

class Task extends React.Component<TaskProps, TaskState> {
  state = {
    content: null
  };

  async componentDidMount() {
    this.setState({
      content: {
        __html: await itemContent(this.props.task)
      }
    });
  }

  async componentDidUpdate(prevProps) {
    if (this.props.task !== prevProps.task) {
      this.setState({
        content: {
          __html: await itemContent(this.props.task)
        }
      });
    }

    twttr.widgets.load(document.getElementById('current-task'));
  }

  render() {
    const { content } = this.state;

    if (!content) {
      return null;
    }

    const { project, labels } = this.props;

    const labelItems =
      labels && labels.length
        ? labels.map((label, index) => (
            <>
              <span key={label.name} style={{ color: LABEL_COLORS[label.color] }}>
                {label.name}
              </span>
              {index < labels.length - 1 && <span key={`${label.name}-seperator`}>,&nbsp;</span>}
            </>
          ))
        : 'No labels';

    return (
      <>
        <Button.Group attached="top" basic size="large" widths="2">
          <Button>
            <kbd>P</kbd>
            {project.name}{' '}
            <Label circular style={{ backgroundColor: PROJECT_COLORS[project.color] }} empty />
          </Button>

          <Button>
            <kbd>L</kbd>
            {labelItems}
          </Button>
        </Button.Group>

        <Segment attached className="task-container">
          <div className="current-task" dangerouslySetInnerHTML={content} />
        </Segment>

        <Button.Group attached="bottom" basic size="large" widths="5">
          <Button>
            <kbd>←</kbd> Previous
          </Button>

          <Button color="red">
            <kbd>X</kbd> Delete
          </Button>

          <Button>
            <kbd>D</kbd> Due date
          </Button>

          <Button>
            <kbd>C</kbd> Complete
          </Button>

          <Button>
            <kbd>→</kbd> Next
          </Button>
        </Button.Group>
      </>
    );
  }
}

class LoggedOut extends React.Component<{}> {
  render() {
    return (
      <Grid middle aligned center>
        <Grid.Column>
          <Header image color="red">
            <Header.Content>Log-in to your account</Header.Content>
          </Header>

          <Segment stacked>
            <a className="ui fluid large red submit button" href="/connect/todoist">
              Log in with Todoist
            </a>
          </Segment>
        </Grid.Column>
      </Grid>
    );
  }
}

type TaskConveyorState = {
  currentItem: number,
  data: {}
};

class TaskConveyor extends React.Component<{}, TaskConveyorState> {
  state = {
    currentItem: 0,
    data: {}
  };

  async componentDidMount() {
    const taskResponse = await fetch('/tasks/');
    const taskJson = await taskResponse.json();

    this.setState({ data: taskJson });

    Mousetrap.bind(['left', 'up', 'k'], () => {
      if (this.state.currentItem < 1) {
        return false;
      }

      this.setState(state => ({ currentItem: state.currentItem - 1 }));

      return false;
    });

    Mousetrap.bind(['enter', 'right', 'down', 'j'], () => {
      if (this.state.currentItem >= this.state.data.todoist?.items?.length - 1) {
        return false;
      }

      this.setState(state => ({ currentItem: state.currentItem + 1 }));

      return false;
    });
  }

  componentWillUnmount() {
    Mousetrap.unbind(['left', 'up', 'k']);
    Mousetrap.unbind(['enter', 'right', 'down', 'j']);
  }

  render() {
    const { currentItem, data } = this.state;
    const task = data.todoist?.items && data.todoist.items[currentItem];

    let labels;
    let project;

    if (task) {
      labels = task.labels.map(label => this.state.data.todoist.labels.find(l => l.id === label));
      project = this.state.data.todoist.projects.find(p => p.id === task.project_id);
    }

    return (
      <>
        <Menu vertical>
          <Menu.Item active>
            <Label color="red">{this.state.data?.overdue?.length}</Label>
            Today
          </Menu.Item>

          <Menu.Item>
            <Label>{this.state.data?.inbox?.length}</Label>
            Inbox
          </Menu.Item>

          <Menu.Item>
            <Label>{this.state.data?.unusedLabels?.length}</Label>
            Unused labels
          </Menu.Item>
        </Menu>

        {task && <Task labels={labels} project={project} task={task} />}

        <Progress
          attached="bottom"
          className="task-progress"
          color="blue"
          size="tiny"
          total={data.todoist?.items?.length}
          value={currentItem + 1}
        />
      </>
    );
  }
}

ReactDOM.render(
  <BrowserRouter>
    <Grid centered container className="main-column">
      <Grid.Column width={16}>
        <Header size="huge" className="main-header">
          <Header.Content>
            <a href="/">Task Conveyor</a>
          </Header.Content>
        </Header>

        {window.loggedIn ? <TaskConveyor /> : <LoggedOut />}
      </Grid.Column>
    </Grid>
  </BrowserRouter>,

  document.getElementById('root')
);
