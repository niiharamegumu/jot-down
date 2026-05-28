import { describe, expect, it } from 'vitest';
import {
  getApplicableNoteTemplates,
  getNoteTemplateCompletion,
  sortNoteTemplatesByName,
  type NoteTemplate
} from './noteTemplate';

describe('Note template order', () => {
  it('sorts templates by their names without mutating the input', () => {
    const templates = [template('2', '週次'), template('1', '会議')];

    expect(sortNoteTemplatesByName(templates).map((item) => item.name)).toEqual(['会議', '週次']);
    expect(templates.map((item) => item.id)).toEqual(['2', '1']);
  });
});

describe('Note template completion', () => {
  it('requires a name and Markdown text', () => {
    expect(getNoteTemplateCompletion(template('1', '', 'body'), []).reason).toBe(
      '名前が未入力です'
    );
    expect(getNoteTemplateCompletion(template('1', '会議', '  '), []).reason).toBe(
      '本文が未入力です'
    );
  });

  it('treats duplicate names as incomplete', () => {
    const templates = [template('1', '会議', 'a'), template('2', ' 会議 ', 'b')];

    expect(getNoteTemplateCompletion(templates[0], templates).reason).toBe('名前が重複しています');
  });

  it('returns only applicable templates in name order', () => {
    const templates = [
      template('weekly', '週次', '# 週次'),
      template('empty', '空', ''),
      template('meeting', '会議', '# 会議')
    ];

    expect(getApplicableNoteTemplates(templates).map((item) => item.id)).toEqual([
      'meeting',
      'weekly'
    ]);
  });
});

function template(id: string, name: string, markdown = '# body'): NoteTemplate {
  return { id, name, markdown, updatedAt: '2026-05-01T00:00:00.000Z' };
}
