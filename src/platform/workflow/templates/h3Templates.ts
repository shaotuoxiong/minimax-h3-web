import type { WorkflowTemplates } from './types/template'

export const h3Templates: WorkflowTemplates[] = [
  {
    moduleName: 'MiniMax H3',
    title: 'MiniMax H3',
    category: 'Video',
    type: 'video',
    templates: [
      {
        name: 'H3-T2V-lowvram',
        title: 'H3 · 文生视频',
        description:
          '只需文字描述，无需上传素材。已配置本机 INT8 模型、低显存设置和短视频参数。',
        mediaType: 'image',
        mediaSubtype: 'svg',
        openSource: true,
        isEssential: true,
        models: ['MiniMax H3'],
        tags: ['Text to Video', 'INT8']
      },
      {
        name: 'H3-I2V-lowvram',
        title: 'H3 · 图生视频',
        description:
          '上传一张图片，再描述动作和镜头。已配置本机 INT8 模型和低显存设置。',
        mediaType: 'image',
        mediaSubtype: 'svg',
        openSource: true,
        isEssential: true,
        models: ['MiniMax H3'],
        tags: ['Image to Video', 'INT8']
      }
    ]
  }
]

export function h3TemplateUrl(name: string, extension: 'json' | 'svg') {
  if (
    import.meta.env.VITE_H3_ONLY !== 'true' ||
    !h3Templates[0].templates.some((template) => template.name === name)
  )
    return undefined
  return `${import.meta.env.BASE_URL}workflows/${name}.${extension}`
}
