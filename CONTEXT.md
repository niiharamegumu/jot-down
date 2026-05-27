# Jot Down

Jot Down is a local-first note context for quickly writing lightweight Markdown notes that can include checkable tasks without separating editing from reading.

## Language

**App update**:
A newly available version of Jot Down that the app can detect in the background but should only apply when the user chooses to update. Applying an app update must not silently interrupt note writing.
_Avoid_: Forced refresh, automatic reload, program update

**Autosave**:
The expectation that note changes are kept without a user-facing save action, using prompt background persistence after edits and when editing focus is left. Save failures should be visible without discarding the user's current note text.
_Avoid_: Save button, draft state, persistent saved indicator

**Local note store**:
The browser-resident place where notes are kept for offline use on the current device. Each device has its own local note store; it has no user account owner, is expected to retain notes during normal use of that browser, and does not include cross-tab conflict resolution, user-managed Markdown files, or synced cloud storage. If the local note store is unavailable, the app should make saving unavailable clear rather than pretending notes can be kept.
_Avoid_: Local folder, cloud sync, file vault, account, import/export

**Markdown live editing**:
A single editing surface where Markdown text remains the source of truth while task markers and headings are visually structured in place as the user types. Editing a focused block must preserve the block's visual scale and layout so cursor placement does not cause distracting typography or position shifts; supported structures come from typed Markdown shapes rather than a separate block-type control, and list-like structures continue naturally on Enter until the user exits with an empty item.
_Avoid_: Separate preview, rendered-only document, edit/preview mode, layout-shifting focus state, block-type menu

**Note**:
The user-facing unit of writing. A user can have multiple notes, and each note contains Markdown text, including any tasks written inside it.
_Avoid_: Document, page, list

**Note deletion**:
A confirmed action that removes a note from the local note store without creating a separate recoverable place for it. Empty notes remain until explicitly deleted, deletion confirmation must make the lack of recovery clear, and deleting the active note should leave another note ready for writing.
_Avoid_: Trash, archive

**Note title**:
The display name of a note, derived from the first heading of any level in the note's Markdown text, or from the first non-empty line when no heading exists. A note with no usable non-whitespace text is shown as untitled without storing that as note content.
_Avoid_: Separate title field, filename

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
The expectation that the app's note creation, editing, checking, searching, and deletion behavior works without a network connection.
_Avoid_: App-shell-only offline mode

**Supported Markdown**:
The Markdown shapes treated as first-class in the app: headings, paragraphs, `-` bullet lists, and checkable task items. First-class structures should carry matching visual and accessible meaning. Other Markdown-like text may be kept in notes, but is not treated as a first-class structure.
_Avoid_: Full Markdown editor, GitHub Flavored Markdown surface

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

Developer: "Can users drag tasks or notes into a custom order?"
Domain expert: "Not initially. Notes follow recent editing, and tasks follow the order of the note text."

Developer: "When users search, are they searching tasks?"
Domain expert: "No. They search note text, which may include tasks."
