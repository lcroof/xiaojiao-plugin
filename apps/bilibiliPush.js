import { rulePrefix } from '../utils/common.js'
import bili from "../components/bilibili.js"
import biliPush from '../components/biliPush.js'

export class BilibiliPush extends plugin {
  constructor(e) {
    super({
      name: 'B站推送-面板',
      dsc: 'B站消息推送',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: `^${rulePrefix}(订阅|增加|新增|移除|去除|取消)推送\\s*.*$`,
          fnc: 'updateBiliPush'
        },
        {
          reg: `^${rulePrefix}推送(群)?列表$`,
          fnc: 'getBiliPushUserList'
        },
        {
          reg: `^#(开启|关闭|允许|禁止)群B站推送\\s*.*$`,
          fnc: 'changeGroupBiliPush'
        },
        {
          reg: `^${rulePrefix}推送ck\\s*.+$`,
          fnc: 'setBiliPushCookie'
        },
        {
          reg: `^${rulePrefix}推送时间\\s*\\d+$`,
          fnc: 'setBiliPushTimeInterval'
        },
        {
          reg: `^${rulePrefix}推送过期时间\\s*\\d+$`,
          fnc: 'setBiliPushFaultTime'
        },
        {
          reg: `^${rulePrefix}(开启|关闭)B站转发推送$`,
          fnc: 'changeBiliPushTransmit'
        },
        {
          reg: `^${rulePrefix}设置(全局)?推送(默认|合并|图片)$`,
          fnc: 'setBiliPushSendType'
        },
        {
          reg: `^${rulePrefix}(开启|关闭|允许|禁止)群\\s*.*推送\\s*.*$`,
          fnc: 'setBiliGroupMemberPush'
        },
        {
          reg: '^测试B站推送$',
          fnc: 'pushScheduleJob'
        }
      ]
    })
  }


  /**
   * 修改推送
   * @param {*} e 
   * @returns 
   */
  async updateBiliPush(e) {
    if (bili.updateBilibiliPush(e))
    {
      e.reply("成功设置推送");
    }
  }

  /**
   * 推送列表更新
   * @param {} e 
   * @returns 
   */
  async getBiliPushUserList(e) {
    if (bili.getBilibiliPushUserList(e))
    {
      e.reply("成功设置推送列表");
    }
  }

  /**
   * 群推送更新
   * @param {*} e 
   * @returns 
   */
  async changeGroupBiliPush(e) {
    if (bili.changeGroupBilibiliPush(e))
    {
      e.reply("成功设置群推送");
    }
  }

  /**
   * 设定cookie
   * @param {*} e 
   * @returns 
   */
  async setBiliPushCookie(e) {
    if (bili.setBiliPushCookie(e))
    {
      e.reply("成功设置cookie");
    }
  }

  /**
   * 设置B站推送间隔时间
   * @param {*} e 
   * @returns 
   */
  async setBiliPushTimeInterval(e) {
    if (bili.setBiliPushTimeInterval(e))
    {
      e.reply("成功设置推送间隔时间");
    }
  }

  /**
   * 设置B站推送过期时间
   * @param {*} e 
   * @returns 
   */
  async setBiliPushFaultTime(e) {
    if (bili.setBiliPushFaultTime(e))
    {
      e.reply("成功设置推送过期时间");
    }
  }

  /**
   * (开启|关闭)B站转发推送
   * @param {*} e 
   * @returns 
   */
  async changeBiliPushTransmit(e) {
    if (bili.changeBiliPushTransmit(e))
    {
      e.reply("成功设置转发推送");
    }
  }

  /**
   * 设置B站推送(默认|合并|图片)
   * @param {*} e 
   * @returns 
   */
  async setBiliPushSendType(e) {
    if (bili.setBiliPushSendType(e))
    {
      e.reply("成功设置推送模式");
    }
  }
  /**
   * 测试推送
   * @param {*} e 
   */
  async pushScheduleJob(e) {
    biliPush.pushScheduleJob(e);
  }
}
