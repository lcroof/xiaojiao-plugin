import setting from './utils/setting.js'
import lodash from 'lodash'
import { pluginResources } from './utils/path.js'
import path from 'path'

// 支持锅巴
export function supportGuoba () {
  let allGroup = []
  Bot.gl.forEach((v, k) => { allGroup.push({ label: `${v.group_name}(${k})`, value: k }) })
  return {
    pluginInfo: {
      name: 'bilibili-plugin',
      title: 'B站推送插件',
      author: '@欧阳青瓜',
      authorLink: 'https://gitee.com/lcroof',
      link: 'https://gitee.com/lcroof/bilibili-plugin',
      isV3: true,
      isV2: false,
      description: '提供YunzaiBot B站视频解析和B站动态推送',
      icon: 'bi:box-seam',
      iconColor: '#7ed99e',
      iconPath: path.join(pluginResources, 'common/cont/pamu.png')
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [{
        component: 'Divider',
        label: '通用设置'
      },
      ],
      getConfigData () {
        return setting.merge()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData (data, { Result }) {
        let config = {}
        for (let [keyPath, value] of Object.entries(data)) {
          lodash.set(config, keyPath, value)
        }
        config = lodash.merge({}, setting.merge, config)
        setting.analysis(config)
        return Result.ok({}, '保存成功~')
      }
    }
  }
}
