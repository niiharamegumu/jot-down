export type NoteTemplate = {
  id: string;
  name: string;
  markdown: string;
  updatedAt: string;
};

export type NoteTemplateCompletion = {
  complete: boolean;
  reason: string | null;
};

export function createNoteTemplate(
  name = '',
  markdown = '',
  id: string = crypto.randomUUID()
): NoteTemplate {
  return {
    id,
    name,
    markdown,
    updatedAt: new Date().toISOString()
  };
}

export function sortNoteTemplatesByName(templates: NoteTemplate[]): NoteTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, 'ja-JP'));
}

export function getNoteTemplateCompletion(
  template: NoteTemplate,
  templates: NoteTemplate[]
): NoteTemplateCompletion {
  if (!template.name.trim()) {
    return { complete: false, reason: '名前が未入力です' };
  }

  if (!template.markdown.trim()) {
    return { complete: false, reason: '本文が未入力です' };
  }

  const normalizedName = template.name.trim().toLocaleLowerCase();
  const duplicate = templates.some(
    (item) => item.id !== template.id && item.name.trim().toLocaleLowerCase() === normalizedName
  );
  if (duplicate) {
    return { complete: false, reason: '名前が重複しています' };
  }

  return { complete: true, reason: null };
}

export function getApplicableNoteTemplates(templates: NoteTemplate[]): NoteTemplate[] {
  return sortNoteTemplatesByName(
    templates.filter((template) => getNoteTemplateCompletion(template, templates).complete)
  );
}
