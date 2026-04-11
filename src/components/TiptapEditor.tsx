'use client';

import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline as UnderlineIcon, Palette, Type } from 'lucide-react';
import { useEffect } from 'react';

// Custom Font Size Extension
const FontSize = Extension.create<any>({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
    };
  },
});

const FONT_SIZES = ['14px', '16px', '20px', '24px', '32px', '48px', '64px'];

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-secondary/50 border-b border-border/60">
      {/* Font Size Dropdown */}
      <div className="flex items-center space-x-1 px-2 border-r border-border/40 mr-1">
        <Type size={14} className="text-muted-foreground mr-1" />
        <select
          onChange={(e) => (editor.commands as any).setFontSize(e.target.value)}
          value={editor.getAttributes('textStyle').fontSize || '16px'}
          className="bg-transparent text-[11px] font-black tracking-widest outline-none cursor-pointer hover:text-primary transition-colors py-1 pr-1"
        >
          {FONT_SIZES.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-2 rounded-lg transition-all hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-primary text-white hover:bg-primary/90' : 'text-muted-foreground'}`}
      >
        <Bold size={16} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 rounded-lg transition-all hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-primary text-white hover:bg-primary/90' : 'text-muted-foreground'}`}
      >
        <Italic size={16} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-2 rounded-lg transition-all hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-primary text-white hover:bg-primary/90' : 'text-muted-foreground'}`}
      >
        <UnderlineIcon size={16} strokeWidth={2.5} />
      </button>

      <div className="w-[1px] h-6 bg-border/60 mx-1 self-center" />

      {/* Color Picker */}
      <div className="flex items-center space-x-2 p-1.5 hover:bg-gray-200 rounded-lg group transition-all">
        <Palette size={16} className="text-muted-foreground group-hover:text-primary" />
        <input
          type="color"
          onChange={(e: any) => {
            const color = e.target.value;
            editor.chain().focus().setColor(color).run();
          }}
          className="w-5 h-5 rounded cursor-pointer border-none bg-transparent"
          value={editor.getAttributes('textStyle').color || '#000000'}
        />
      </div>
    </div>
  );
};

interface TiptapEditorProps {
  initialContent?: any;
  onChange: (content: any) => void;
  onSave?: () => void;
  setEditor?: (editor: any) => void;
  readonly?: boolean;
}

export default function TiptapEditor({ initialContent, onChange, onSave, setEditor, readonly }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      FontSize,
      TextStyle,
      Color,
      Underline,
      Image,
      Placeholder.configure({
        placeholder: 'Start writing your story...',
      }),
    ],
    content: initialContent,
    editable: !readonly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          onSave?.();
          return true;
        }
        return false;
      },
      attributes: {
        class: `prose-edit-zone prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none max-w-none text-foreground leading-relaxed ${!readonly ? 'min-h-[600px] p-8' : 'p-0'}`,
      },
    },
  });

  useEffect(() => {
    if (editor && setEditor) {
      setEditor(editor);
    }
  }, [editor, setEditor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readonly);
    }
  }, [editor, readonly]);

  return (
    <div className={!readonly 
      ? "bg-white rounded-[2rem] border border-border shadow-sm overflow-hidden min-h-[650px] transition-all hover:shadow-md" 
      : "w-full min-h-[200px]"
    }>
      {!readonly && <MenuBar editor={editor} />}
      <div className="relative">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
