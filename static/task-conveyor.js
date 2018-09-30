// @flow

/* globals Mousetrap:true twttr:true */

import 'semantic-ui-css/semantic.min.css';

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { Grid, Header, Label, Menu, Segment } from 'semantic-ui-react';

async function parseContent(content) {
  const tweet = content.match(/^https?:\/\/twitter.com\/[a-z0-9_]+\/status\/\d+/i);

  if (tweet) {
    const response = await fetch(`/tweet/${btoa(tweet)}`);

    return response.json();
  }

  // TODO return HTML here
  return content.replace(/(https?:\/\/[^ ]+) \(([^()]+)\)/g, '<a href="$1">$2</a>');
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

  const url = content.match(/https?:\/\/(t\.co|bit\.ly)([^ ”<>\b]+|$)/);

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
    return (
      <React.Fragment>
        {this.state.content && (
          <Segment stacked id="task">
            <div id="current-task" dangerouslySetInnerHTML={this.state.content} />

            <div className="project">{this.props.project?.name || ''}</div>

            <ul id="labels">
              {this.props.labels.map(label => (
                <li>{label.name}</li>
              ))}
            </ul>
          </Segment>
        )}
      </React.Fragment>
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

  render() {
    console.log({ state: this.state });

    const task =
      this.state.data.todoist?.items && this.state.data.todoist.items[this.state.currentItem];

    let labels;
    let project;

    if (task) {
      labels = task.labels.map(label => this.state.data.todoist.labels.find(l => l.id === label));
      project = this.state.data.todoist.projects.find(p => p.id === task.project_id);
    }

    console.log({ project });

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
      </>
    );
  }
}

ReactDOM.render(
  <BrowserRouter>
    <Grid centered container style={{ paddingTop: '2em' }}>
      <Grid.Column width={16}>
        <Header size="huge" style={{ marginBottom: '1em' }}>
          <Header.Content>
            <a href="/">Task Conveyor</a>
          </Header.Content>
        </Header>

        <TaskConveyor />
      </Grid.Column>
    </Grid>
  </BrowserRouter>,

  document.getElementById('root')
);
