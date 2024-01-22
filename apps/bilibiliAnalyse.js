import _ from 'lodash'
import { rulePrefix } from '../utils/common.js'
import bilibili from "../components/bilibili.js"


export class BilibiliAnalyse extends plugin {
    constructor(e) {
        super({
            name: 'B站解析-面板',
            dsc: 'B站视频解析',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: `^${rulePrefix}(开启|关闭)视频解析$`,
                    fnc: 'updateBilibiliAnalyse'
                }
            ]
        })
    }

    /**
       * 修改推送
       * @param {*} e 
       * @returns 
       */
    async updateBilibiliAnalyse(e) {
        if (bilibili.updateBilibiliPush(e)) {
            e.reply("成功设置推送");
        }
    }
}