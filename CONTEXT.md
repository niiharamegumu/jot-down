# Jot Down

Jot Down is a local-first note context for quickly writing lightweight Markdown notes that can include checkable tasks without separating editing from reading.

## Language

**App update**:
A newly available version of Jot Down that the app can detect in the background but should only apply when the user chooses to update. Applying an app update must not silently interrupt note writing.
_Avoid_: Forced refresh, automatic reload, program update

**Autosave**:
The expectation that note and note template changes are kept without a user-facing save action, using prompt background persistence after edits and when editing focus is left. Save failures should be visible without discarding the user's current note or note template text.
_Avoid_: Save button, draft state, persistent saved indicator

**Local note store**:
The browser-resident place where notes and note templates are kept for offline use on the current device. Each device has its own local note store; it has no user account owner, is expected to retain notes and note templates during normal use of that browser, and does not include cross-tab conflict resolution, user-managed Markdown files, or synced cloud storage. If the local note store is unavailable, the app should make saving unavailable clear rather than pretending notes or note templates can be kept.
_Avoid_: Local folder, cloud sync, file vault, account, import/export

**List navigation**:
The user-facing navigation area for moving between notes or between note templates. List navigation may be opened or closed as a local display preference only when the layout can keep list and detail visible as separate regions; on small-screen layouts it is a separate list view rather than a collapsible region. Closing it does not change note order, note search, note template management, or the selected note or note template.
_Avoid_: Folder tree, file explorer, notebook switcher

**Markdown live editing**:
A single editing surface where Markdown text remains the source of truth while task markers and headings are visually structured in place as the user types. Editing behavior follows the Markdown editor's native list and task semantics rather than preserving app-specific empty task states, while focused blocks must keep their visual scale and layout stable enough that cursor placement does not cause distracting typography or position shifts.
_Avoid_: Separate preview, rendered-only document, edit/preview mode, layout-shifting focus state, block-type menu

**Note**:
The user-facing unit of writing. A user can have multiple notes, and each note contains Markdown text, including any tasks written inside it.
_Avoid_: Document, page, list

**Note line**:
A single Markdown line inside a note's text, treated as one movable writing unit even when it wraps visually in the editor. A task is a note line whose checked state is part of that line's Markdown text.
_Avoid_: Visual row, task object, block record

**Note line movement**:
A keyboard-driven note edit that moves the current non-empty note line earlier or later within the same note text while skipping blank lines as spacing. Moving a line only changes its position; indentation, parent-child-looking Markdown, and task checked state remain part of the moved line's Markdown text.
_Avoid_: Drag sorting, task sorting, toolbar reorder action, moving a task object

**Note deletion**:
A confirmed action that removes a note from the local note store without creating a separate recoverable place for it. Empty notes remain until explicitly deleted, deletion confirmation must make the lack of recovery clear, and deleting the active note should leave another note ready for writing.
_Avoid_: Trash, archive

**Deletion target note**:
A note that the user has marked for a future deletion action without necessarily opening it for editing. Deletion target selection is separate from the currently open note, and marking a note as a deletion target does not change note content or note order.
_Avoid_: Selected note, active note, checked task, queued deletion

**Note duplication**:
An action that creates a separate note with the same Markdown text as an existing note. The duplicate is a normal note immediately after creation and does not retain a relationship to the original note.
_Avoid_: Clone link, version, fork, copy marker

**Note Markdown copy**:
An action that places the currently open note's Markdown text on the system clipboard without creating, changing, or saving a note. The copied text is the note text itself, including any unsaved visible edits.
_Avoid_: Note duplication, export, share, rendered copy

**Note title**:
The display name of a note, derived from the first heading of any level in the note's Markdown text, or from the first non-empty line when no heading exists. A note with no usable non-whitespace text is shown as untitled without storing that as note content.
_Avoid_: Separate title field, filename

**Note template**:
A reusable Markdown pattern kept outside the note list and used as starting or inserted text for a note. A note template is authored with the same Markdown live editing expectations as a note, but is not itself a note, does not appear in note search or note order, and only becomes note content when applied to a note.
_Avoid_: Starter note, document template, snippet

**Note template application**:
The act of turning a note template into note Markdown, either as the initial text of a new note or as text inserted unchanged at the current cursor position inside an existing note. Applying a note template is a note edit, not a relationship that remains attached to the note.
_Avoid_: Template binding, template instance, note type

**Note template management**:
The user-facing place for creating, renaming, editing, and deleting note templates outside the note list. Note template management does not create notes until a note template is applied.
_Avoid_: Template registration only, note editing, settings

**Note template name**:
The unique user-facing label used to identify a note template before it is applied. Unlike a note title, a note template name is separate from the template's Markdown text and is not inserted into a note unless the Markdown text itself includes it.
_Avoid_: Note title, filename, heading-derived name

**Note updated time**:
The user-visible recency signal for a note, reflecting when the note's Markdown text was last edited.
_Avoid_: Created time as primary note metadata

**Note order**:
The order in which notes are shown to the user, based on recent editing rather than manual arrangement.
_Avoid_: Manual sort order, pinned notes, folders, tags

**Note search**:
A way to find notes by case-insensitive partial text matching inside their Markdown content. Search is note-oriented, not a separate task lookup, and matching notes keep the normal note order.
_Avoid_: Task search, structured query, fuzzy search

**Note snippet**:
A short preview of a note's Markdown text used to help identify the note in a list.
_Avoid_: Task summary, generated description

**Offline use**:
The expectation that the app's note creation, editing, checking, searching, deletion, note template management, and note template application behavior works without a network connection.
_Avoid_: App-shell-only offline mode

**Supported Markdown**:
The Markdown shapes treated as first-class in the app: headings, paragraphs, `-` bullet lists, checkable task items, links, and strong emphasis. First-class structures should carry matching visual and accessible meaning. Other Markdown-like text may be kept in notes, but is not treated as a first-class structure.
_Avoid_: Full Markdown editor, GitHub Flavored Markdown surface

**Link**:
A clickable web address inside Markdown note text, written either as a plain URL or as Markdown link text. A link belongs to the note text and does not create a separate bookmark or attachment.
_Avoid_: Bookmark, attachment, rich embed, preview card

**Strong emphasis**:
Inline Markdown note text that the user marks as more prominent and sees as bold text. Strong emphasis belongs to the note text and does not create a separate style object.
_Avoid_: Rich text styling, font weight setting, text style object

**Starter note**:
The first note shown in a new local note store, containing editable example content instead of a separate onboarding flow.
_Avoid_: Tutorial modal, empty first run

**Task**:
A checkable item written inside a Markdown note using `- [ ]` or `- [x]`, with `- [X]` accepted as checked input. A task may be indented, and indentation may be changed as Markdown text editing, but indentation does not create a separate parent-child task model. A task's checked state is part of the note text, and the task does not exist independently from the note that contains it; checked tasks remain in place but appear visually subdued. A visually checkable task should behave like an accessible checkbox.
_Avoid_: Standalone todo item, issue, due date, reminder, notification, subtask model, numbered task

## Example Dialogue

Developer: "When a user types a task, do they leave the Markdown editor?"
Domain expert: "No. Markdown live editing means the same surface keeps the text editable while showing task structure in place."

Developer: "Can a task be moved between notes as its own object?"
Domain expert: "No. A task is part of the Markdown note text; moving it means editing the note."

Developer: "When a task is checked, where is that state stored?"
Domain expert: "In the note text. Checking a task changes the Markdown."

Developer: "Is deleting a task different from editing a note?"
Domain expert: "No. Deleting a task means removing that line from the note text."

Developer: "Should the sidebar say documents or pages?"
Domain expert: "No. The user is writing notes; document and page are implementation or product-category words."

Developer: "Where does a note title come from?"
Domain expert: "From the note text. If the user wants to rename a note, they edit the note content."

Developer: "If a task line wraps onto two visual rows, can the wrapped part be moved separately?"
Domain expert: "No. A note line is one Markdown line, so the whole line moves together."

Developer: "When a checked task line is moved, is the task's checked state reattached somewhere else?"
Domain expert: "No. The checked marker moves with the note line because it is part of that line's Markdown text."

Developer: "When a note is duplicated, should the app add '(copy)' to the heading?"
Domain expert: "No. Note duplication creates another note with the same Markdown text. Changing the heading would change the duplicated note content."

Developer: "Does a duplicated note remember the original note?"
Domain expert: "No. The duplicate is a normal note immediately after creation."

Developer: "When a user copies a Note, does that create another Note?"
Domain expert: "No. Note Markdown copy only places the open Note's Markdown text on the clipboard."

Developer: "When the user marks several notes in the list for deletion, are those the selected notes?"
Domain expert: "Call them deletion target notes. The selected or open note is the one being edited, while deletion target notes are only marked for a future deletion action."

Developer: "Does marking a note as a deletion target open it or move it in note order?"
Domain expert: "No. It only marks the note for deletion and leaves editing and ordering unchanged."

Developer: "Should reusable meeting notes appear in the note list until someone uses them?"
Domain expert: "No. That is a note template, not a note. It becomes note content only when applied."

Developer: "After applying a note template, does the note remember which template it came from?"
Domain expert: "No. Applying a note template is just a note edit; the note keeps Markdown text, not a template link."

Developer: "Can a note template be renamed by changing its first heading?"
Domain expert: "No. A note template has its own name; headings inside the template are Markdown that may later become note content."

Developer: "Does opening note template management create a new note?"
Domain expert: "No. Notes are only created when the user creates a note directly or applies a note template as a new note."

Developer: "Can users drag tasks or notes into a custom order?"
Domain expert: "Not initially. Notes follow recent editing, and tasks follow the order of the note text."

Developer: "When users search, are they searching tasks?"
Domain expert: "No. They search note text, which may include tasks."
