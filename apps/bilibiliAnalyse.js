import _ from 'lodash'
import { rulePrefix } from '../utils/common.js'
import bilibili from "../components/bilibili.js"
import nga from "../components/nga.js"


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
                },
                {
                    reg: `^$(开启|关闭)NGA链接解析$`,
                    fnc: 'updateNgaAnalyse'
                },
                {
                    reg: `.*(b23.tv.*\\/[A-Za-z0-9]+|bilibili.com\/.*\/[A-Za-z0-9]+).*$`,
                    fnc: 'biliMsgAnalyse'
                },
                {
                    reg: `(https://ngabbs).*tid\=[0-9]+`,
                    fnc: 'ngaMsgAnalyse'
                },
            ]
        })
    }

    /**
       * 修改bv解析
       * @param {*} e 
       * @returns 
       */
    async updateBilibiliAnalyse(e) {
        if (bilibili.updateBvAnalyse(e)) {
            e.reply("成功设置解析");
        }
    }

    /**
       * 修改解析
       * @param {*} e 
       * @returns 
       */
    async updateNgaAnalyse(e) {
        if (bilibili.updateNgaAnalyse(e)) {
            e.reply("成功设置解析");
        }
    }
    /**
     * 消息解析
     * @param {*} e 
     */
    async biliMsgAnalyse(e) {
        bilibili.msgAnalyse(e);        
    }
    /**
     * 消息解析
     * @param {*} e 
     */
    async ngaMsgAnalyse(e) {
        nga.msgAnalyse(e);        
    }
}