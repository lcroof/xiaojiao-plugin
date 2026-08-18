/**
 *  支持锅巴
 *  锅巴插件：https://gitee.com/guoba-yunzai/guoba-plugin.git
 *  组件类型，可参考 https://vvbin.cn/doc-next/components/introduction.html
 *  https://antdv.com/components/overview-cn/
 */

import common from './common/commonFunction.js'

export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'xiaojiao-plugin',
      title: 'xiaojiao-plugin',
      author: '@lcroof',
      authorLink: 'https://gitee.com/lcroof',
      link: 'https://gitee.com/lcroof/xiaojiao-plugin',
      isV3: true,
      isV2: false,
      description: 'B站/NGA链接解析与B站动态推送插件',
      // 图标可在 https://icon-sets.iconify.design 搜索
      icon: 'mdi:cat',
      iconColor: '#fb7299'
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        {
          field: 'analyse.bili',
          label: 'B站视频解析',
          bottomHelpMessage: '是否解析B站视频链接（对应 #开启视频解析 / #关闭视频解析）',
          component: 'Switch'
        },
        {
          field: 'analyse.nga',
          label: 'NGA链接解析',
          bottomHelpMessage: '是否解析NGA帖子链接（对应 #开启NGA链接解析 / #关闭NGA链接解析）',
          component: 'Switch'
        },
        {
          field: 'push.dynamicPushTimeInterval',
          label: 'B站动态推送间隔(分钟)',
          bottomHelpMessage: '推送间隔时间，范围 1-60',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            max: 60
          }
        },
        {
          field: 'push.dynamicPushFaultTime',
          label: 'B站动态推送过期时间(小时)',
          bottomHelpMessage: '允许推送多久以前的动态，范围 1-24',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            max: 24
          }
        },
        {
          field: 'push.sendType',
          label: 'B站动态推送方式',
          bottomHelpMessage: '默认 / 合并 / 图片',
          component: 'Select',
          componentProps: {
            options: [
              { label: '默认', value: 'default' },
              { label: '合并', value: 'merge' },
              { label: '图片', value: 'picture' }
            ],
            placeholder: '请选择推送方式'
          }
        }
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        let analyse = common.getAnalyseConfig()
        let push = common.readData('BilibiliPushConfig', 'json') || {}
        return {
          analyse: {
            bili: analyse.bili !== false,
            nga: analyse.nga !== false
          },
          push: {
            dynamicPushTimeInterval: push.dynamicPushTimeInterval || 10,
            dynamicPushFaultTime: push.dynamicPushFaultTime || 1,
            sendType: push.sendType || 'default'
          }
        }
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        try {
          if (data.analyse) {
            let analyse = common.readData('AnalyseConfig', 'json') || {}
            analyse.bili = data.analyse.bili
            analyse.nga = data.analyse.nga
            common.saveData('AnalyseConfig', analyse, 'json')
          }
          if (data.push) {
            let push = common.readData('BilibiliPushConfig', 'json') || {}
            push.dynamicPushTimeInterval = Number(data.push.dynamicPushTimeInterval)
            push.dynamicPushFaultTime = Number(data.push.dynamicPushFaultTime)
            push.sendType = data.push.sendType
            common.saveData('BilibiliPushConfig', push, 'json')
          }
          return Result.ok({}, '保存成功~')
        } catch (err) {
          return Result.err(err)
        }
      }
    }
  }
}
