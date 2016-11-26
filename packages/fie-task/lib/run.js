'use strict';

const log = require('fie-log')('fie-task');
const runFunction = require('./run-function');
const spawn = require('cross-spawn');
const co = require('co');
const utils = require('./utils');

const COMMAND_PARAM_HOOK = '$$';

/**
 * 运行单个任务
 * @param task
 * @param args
 * @param hookParam
 * @return {boolean} 是否继续往下执行, 为 false 的话,不继续执行,后面进程直接退出
 */
function* oneTask(task, args, hookParam) {
  // 设置环境变量
  const env = task.env || {};
  const oldEnv = {};
  Object.keys(env).forEach((item) => {
    oldEnv.item = process.env[item];
    process.env[item] = env[item];
  });

  const resetEnv = () => {
    Object.keys(oldEnv).forEach((item) => {
      process.env[item] = oldEnv[item];
    });
  };

  // task是一个function时,执行function
  if (task.func) {
    const res = yield runFunction({
      method: task.func,
      args
    });
    resetEnv();
    return res;
  } else if (task.command) {
    return yield new Promise((resolve, reject) => {
      const command = task.command.replace(COMMAND_PARAM_HOOK, hookParam).split(' ');

      const child = spawn(command.splice(0, 1).pop(), command, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit'
      });
      // 任务流执行失败
      child.on('error', (err) => {
        resetEnv();
        reject(err);
      });


      child.on('close', (status) => {
        // 插件自己要退出,则不抛出异常
        // TODO 找潕量的插件验证一下, 还要考虑 eslint 等情况
        if (status === 10) {
          resetEnv();
          resolve(false);
        } else if (status !== 0) {
          const message = `${task.command} 命令执行行失败`;
          log.error(message);
          resetEnv();
          // 这里抛出的错误和全局扑获的错误重复了,先不执行reject吧
          // 看图:http://img3.tbcdn.cn/5476e8b07b923/TB1rrl.OpXXXXb4XFXXXXXXXXXX
          // reject(new Error(message));
        } else {
          resetEnv();
          resolve(true);
        }
      });
    });
  }
  resetEnv();
  return true;
}

function getHookParam(command) {
  let match = false;
  const param = [];
  process.argv.forEach((item) => {
    if (item === command) {
      match = true;
    } else if (match) {
      param.push(item);
    }
  });
  return param.join(' ');
}

/**
 * 运行任务
 * @param options
 */
function* run(options) {
  // 筛选出对应的任务
  const noop = () => {
  };
  const tasks = options.tasks || [];              // 任务流
  const when = options.when || 'before';          // 前置任务还是后置,默认是前置任务
  const args = options.args || [];                // 任务流传进来的参数
  const next = options.next || noop;              // 进入下一个task
  const command = options.command || '';          // 运行的命令
  const newTasks = utils.classify(tasks)[when];
  const hookParam = getHookParam(command);


  log.info(`正在执行行${command}${(when === 'after' ? '后置' : '前置')}任务`);

  for (let i = 0; i < newTasks.length; i += 1) {
    if (newTasks[i].async) {
      // 异步执行
      co(function* () {
        yield oneTask(newTasks[i], args, hookParam);
      });
    } else {
      const result = yield oneTask(newTasks[i], args, hookParam);
      if (result === false) {
        // 用户强制要求退出,则正常退出一下
        process.exit(0);
      }
    }
  }

  log.success(`${command}${(when === 'after' ? '后置' : '前置')}任务执行成功`);
  next();
}

module.exports = run;
