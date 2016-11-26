/**
 * Created by hugo on 16/11/20.
 */

'use strict';

const npm = require('fie-npm');
const utils = require('./utils');

/**
 * 模块是否存在
 */
function* onlineExist(name) {
  name = utils.fullName(name);
  return yield npm.has(name);
}

module.exports = onlineExist;
