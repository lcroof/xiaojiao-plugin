import _ from 'lodash'
import { rulePrefix } from '../utils/common.js'
import bili from "../components/bilibili.js"
import nga from "../components/nga.js"


export class MessageAnalyse extends plugin {
    constructor(e) {
        super({
            name: 'B站解析-面板',
            dsc: 'B站视频解析',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: `^${rulePrefix}(开启|关闭)视频解析$`,
                    fnc: 'updateBiliAnalyse'
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
                {
                    reg: `B站解析测试`,
                    fnc: 'biliMsgAnalyseTest'
                },
                {
                    reg: `NGA解析测试`,
                    fnc: 'ngaMsgAnalyseTest'
                }
            ]
        })
    }

    /**
       * 修改bv解析
       * @param {*} e 
       * @returns 
       */
    async updateBiliAnalyse(e) {
        if (bili.updateBvAnalyse(e)) {
            e.reply("成功设置解析");
        }
    }

    /**
       * 修改nga解析
       * @param {*} e 
       * @returns 
       */
    async updateNgaAnalyse(e) {
        if (nga.updateNgaAnalyse(e)) {
            e.reply("成功设置解析");
        }
    }

    /**
     * bili消息解析
     * @param {*} e 
     */
    async biliMsgAnalyse(e) {
        bili.msgAnalyse(e);        
    }

    /**
     * nga消息解析
     * @param {*} e 
     */
    async ngaMsgAnalyse(e) {
        nga.msgAnalyse(e);        
    }

    /**
     * bili消息解析测试
     * @param {*} e 
     */
    async biliMsgAnalyseTest(e) {
        bili.biliAnalyseTest(e);        
    }

    /**
     * nga消息解析测试
     * @param {*} e 
     */
    async ngaMsgAnalyseTest(e) {
        nga.ngaAnalyseTest(e);        
    }
}