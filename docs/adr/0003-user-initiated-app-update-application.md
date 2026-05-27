# Apply app updates only after user action

Jot Down will detect newly available app versions in the background, but it will not automatically reload into them. Because note writing happens in a live editing surface with autosave, applying an update must be a user-initiated action that first gives the active note a chance to persist, then reloads only when the user chooses to update. The persistent update bar is shown only when the app is being used as an installed PWA, because normal browser use can receive the newest app by reloading the page.
