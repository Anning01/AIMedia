import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Node, mergeAttributes } from '@tiptap/core'
import { Bold, Heading1, ImagePlus, Italic, Link2, List, Quote, Redo2, Undo2, UnderlineIcon, Video as VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { contentMetrics } from '@/lib/content-metrics'
import { promptText } from '@/lib/prompt'

const Video = Node.create({
  name: 'video', group: 'block', atom: true,
  addAttributes() { return { src: { default: null }, controls: { default: true }, poster: { default: null }, 'data-asset-id': { default: null } } },
  parseHTML() { return [{ tag: 'video' }] },
  renderHTML({ HTMLAttributes }) { return ['video', mergeAttributes(HTMLAttributes, { controls: 'true' })] },
})

export function RichEditor({ value, onChange, placeholder = '开始编辑内容…' }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, underline: false }), Underline, Image.configure({ allowBase64: false }), Video, Link.configure({ openOnClick: false }), Placeholder.configure({ placeholder })],
    content: value, immediatelyRender: false, onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })
  const state = useEditorState({
    editor,
    selector: () => editor ? {
      heading: editor.isActive('heading', { level: 1 }), bold: editor.isActive('bold'),
      italic: editor.isActive('italic'), underline: editor.isActive('underline'),
      list: editor.isActive('bulletList'), quote: editor.isActive('blockquote'), link: editor.isActive('link'),
      canUndo: editor.can().undo(), canRedo: editor.can().redo(), metrics: contentMetrics(editor.getHTML()),
    } : null,
  })
  useEffect(() => { if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false }) }, [editor, value])
  if (!editor || !state) return null
  const addImage = async () => { const url = await promptText('图片地址'); if (url) editor.chain().focus().setImage({ src: url }).run() }
  const addVideo = async () => {
    const url = await promptText('视频地址')
    if (url) editor.chain().focus().insertContent({ type: 'video', attrs: { src: url, controls: true } }).run()
  }
  const addLink = async () => { const url = await promptText('链接地址'); if (url) editor.chain().focus().setLink({ href: url }).run() }
  return <div className="rich-editor bg-surface">
    <div className="editor-toolbar" role="toolbar" aria-label="正文格式">
      <div className="editor-toolbar-group" role="group" aria-label="编辑历史">
        <Button variant="ghost" size="icon" aria-label="撤销" title="撤销" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="重做" title="重做" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16}/></Button>
      </div>
      <div className="editor-toolbar-group" role="group" aria-label="文字样式">
        <Button variant="ghost" size="icon" aria-label="标题" title="标题" aria-pressed={state.heading} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="粗体" title="粗体" aria-pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="斜体" title="斜体" aria-pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="下划线" title="下划线" aria-pressed={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16}/></Button>
      </div>
      <div className="editor-toolbar-group" role="group" aria-label="段落样式">
        <Button variant="ghost" size="icon" aria-label="列表" title="列表" aria-pressed={state.list} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="引用" title="引用" aria-pressed={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16}/></Button>
      </div>
      <div className="editor-toolbar-group" role="group" aria-label="链接与媒体">
        <Button variant="ghost" size="icon" aria-label="链接" title="链接" aria-pressed={state.link} onClick={addLink}><Link2 size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="图片" title="图片" onClick={addImage}><ImagePlus size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="视频" title="视频" onClick={addVideo}><VideoIcon size={16}/></Button>
      </div>
    </div>
    <EditorContent editor={editor} className="article-editor-content" />
    <footer className="editor-footer"><span>当前正文</span><span>{state.metrics.characters} 字 · {state.metrics.images} 图 · {state.metrics.videos} 视频</span></footer>
  </div>
}
