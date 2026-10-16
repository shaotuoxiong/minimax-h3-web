import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import t2v from '@/assets/workflows/H3-T2V-lowvram.json'
import i2v from '../../../../public/workflows/H3-I2V-lowvram.json'

import { h3TemplateUrl } from './h3Templates'

describe('H3-only workbench', () => {
  it('offers only the two installed workflows without fetching other catalogs or blueprints', async () => {
    vi.stubEnv('VITE_H3_ONLY', 'true')
    const transport = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', transport)
    const templates = await api.getCoreWorkflowTemplates('zh')
    expect(
      templates.flatMap((group) =>
        group.templates.map((template) => template.name)
      )
    ).toEqual(['H3-T2V-lowvram', 'H3-I2V-lowvram'])
    expect(await api.getWorkflowTemplates()).toEqual({})
    expect(await api.getGlobalSubgraphs()).toEqual({})
    expect(transport).not.toHaveBeenCalled()
  })

  it('serves the two workflows from the Pages base path and rejects unrelated names', () => {
    vi.stubEnv('VITE_H3_ONLY', 'true')
    vi.stubEnv('BASE_URL', '/minimax-h3-web/')
    expect(h3TemplateUrl('H3-T2V-lowvram', 'json')).toBe(
      '/minimax-h3-web/workflows/H3-T2V-lowvram.json'
    )
    expect(h3TemplateUrl('H3-I2V-lowvram', 'svg')).toBe(
      '/minimax-h3-web/workflows/H3-I2V-lowvram.svg'
    )
    expect(h3TemplateUrl('other-model', 'json')).toBeUndefined()
    vi.stubEnv('VITE_H3_ONLY', 'false')
    expect(h3TemplateUrl('H3-T2V-lowvram', 'json')).toBeUndefined()
  })

  it.for([t2v, i2v])(
    'keeps a valid H3 workflow with a video output and installed low-VRAM models',
    (data) => {
      const workflow = zComfyWorkflow.parse(data)
      expect(
        workflow.nodes.some((node) => node.type === 'MiniMaxH3ImageToVideo')
      ).toBe(true)
      expect(workflow.nodes.some((node) => node.type === 'SaveVideo')).toBe(
        true
      )
      expect(
        workflow.nodes.find((node) => node.type === 'UNETLoader')
          ?.widgets_values
      ).toContain('minimax_h3_fl2va_pruned_int8_convrot.safetensors')
    }
  )
})
