import lodash from 'lodash'
import fs from 'fs'
import { pathToFileURL } from 'node:url'
import HelpTheme from '../components/helpTheme.js'
import Version from '../components/Version.js'
import { rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'

const _path = process.cwd()
const helpPath = _path + '/plugins/xiaojiao-plugin/resources/help'

export class help extends plugin {
	constructor() {
		super({
			name: 'xiaojiao-plugin-帮助',
			dsc: 'xiaojiao-plugin帮助',
			event: 'message',
			priority: 100,
			rule: [
				{
					reg: '^' + rulePrefix + '(插件)?帮助$',
					fnc: 'help'
				},
				{
					reg: '^#?(小脚|xiaojiao|插件)?(帮助|菜单|help|说明|功能|指令|使用说明|命令)$',
					fnc: 'help'
				},
				{
					reg: '^#?(小脚|xiaojiao|插件)?(版本|更新日志|更新记录)$',
					fnc: 'versionInfo'
				}
			]
		})
	}

	/**
	 * 加载帮助配置：优先 help-cfg.js（自定义），其次 help-list.js（旧版），最后 help-cfg_default.js（默认）
	 */
	async loadHelpCfg() {
		let t = new Date().getTime()
		let name = 'help-cfg_default.js'
		if (fs.existsSync(helpPath + '/help-cfg.js')) {
			name = 'help-cfg.js'
		} else if (fs.existsSync(helpPath + '/help-list.js')) {
			name = 'help-list.js'
		}
		let url = pathToFileURL(helpPath + '/' + name).href + '?version=' + t
		let help = await import(url)

		// 兼容旧字段（helpCfg 直接为数组时）
		if (lodash.isArray(help.helpCfg)) {
			return {
				helpList: help.helpCfg,
				helpCfg: {}
			}
		}
		return help
	}

	async help(e) {
		let custom = await this.loadHelpCfg()
		let defUrl = pathToFileURL(helpPath + '/help-cfg_default.js').href + '?version=' + new Date().getTime()
		let def = await import(defUrl)

		let helpConfig = lodash.defaults(custom.helpCfg, def.helpCfg)
		let helpList = custom.helpList || def.helpList

		let helpGroup = []

		lodash.forEach(helpList, (group) => {
			if (group.auth && group.auth === 'master' && !e.isMaster) {
				return true
			}

			lodash.forEach(group.list, (help) => {
				let icon = help.icon * 1
				if (icon) {
					// 数字icon走雪碧图
					let x = (icon - 1) % 10
					let y = (icon - x - 1) / 10
					help.css = 'background-position:-' + (x * 50) + 'px -' + (y * 50) + 'px'
				} else {
					// emoji/文字icon直接展示
					help.css = ''
				}
			})

			helpGroup.push(group)
		})

		let themeData = await HelpTheme.getThemeData(helpConfig, {})
		return await runtimeRender(e, 'help/index', {
			helpCfg: helpConfig,
			helpGroup,
			...themeData,
			element: 'default'
		}, {
			scale: 1.6
		})
	}

	async versionInfo(e) {
		return await runtimeRender(e, 'help/version-info', {
			currentVersion: Version.version,
			changelogs: Version.changelogs,
			element: 'default'
		}, {
			scale: 1.6
		})
	}
}
