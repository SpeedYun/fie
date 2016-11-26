'use strict';

const debug = require('debug')('fie-npm');
const spawn = require('cross-spawn');
const _ = require('lodash');
const path = require('path');
const dargs = require('dargs');
const request = require('co-request');
const fieEnv = require('fie-env');


const isIntranet = fieEnv.isIntranet();
const registry = isIntranet ? 'http://registry.npm.alibaba-inc.com/' : 'http://registry.npm.taobao.org/';


function* runInstall(installer, paths, options) {
  debug('installer = %s', installer);
  // npm默认值
  const option = _.defaults(options || {}, {
    registry,
    china: true,
    stdio: 'inherit',
    cwd: process.cwd()
  });
  // 将pkg进行扁平化
  if (!Array.isArray(paths) && paths) {
    paths = paths.split(' ') || [];
  }


  // TODO 确认一下是不是这样用法
  const args = paths.concat(dargs(option, {
    aliases: {
      S: '-save',
      D: '-save-dev',
      O: '-save-optional',
      E: '-save-exact'
    }
  }));
  debug('args = %o', args);
  debug('options = %o', option);
  return new Promise((resolve, reject) => {
    spawn(installer, args, option)
      .on('error', (e) => {
        reject(e);
      })
      .on('exit', (err) => {
        if (err) {
          reject(new Error(`install ${paths} error`));
        } else {
          resolve();
        }
      });
  });
}

module.exports = {

  /**
   * 安装npm 包
   * @param pkg
   * @param options
   */
  * install(pkg, options) {
    const installer = path.resolve(__dirname, '../node_modules/.bin/npminstall');
    yield runInstall(installer, pkg, options);
  },

  /**
   * 移除npm包
   */
  * unInstall(pkg, options) {
    const installer = path.resolve(__dirname, '../node_modules/.bin/npmuninstall');
    yield runInstall(installer, pkg, options);
  },

  /**
   * 安装package.json 中的依赖
   */
  * installDependencies(options) {
    const installer = path.resolve(__dirname, '../node_modules/.bin/npminstall');
    yield runInstall(installer, [], options);
  },

  /**
   * 获取最新的包信息
   */
  * latest(name, options) {
    options = Object.assign({}, {
      registry
    }, options);

    let body = null;
    try {
      const res = yield request(`${options.registry}${encodeURIComponent(name)}/latest`);
      body = JSON.parse(res.body);
      if (body.error) {
        body = null;
      }
    } catch (e) {
      // 返回数据出错
      body = null;
    }

    return body;
  },

  /**
   * 是否存在模块
   * @param name
   */
  * has(name, options) {
    options = Object.assign({}, {
      registry
    }, options);
    const res = yield request({
      url: `${options.registry}${encodeURIComponent(name)}/latest`,
      method: 'HEAD'
    });
    return /4\d\d/.test(res.statusCode) === false;
  }


};
