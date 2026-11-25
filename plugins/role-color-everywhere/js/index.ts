import { patchMentionAutocomplete } from './autocomplete'
import { patchMemberList } from './members'
import { patchPollResults } from './polls'
import { patchReactors } from './reactions'
import { patchRows } from './rows'
import SettingsComponent from './settings'
import { DefaultSettings, setStorage } from './shared'
import { patchTypingIndicator } from './typing'
import { patchVoiceUsers } from './voice'
import type { Settings } from './shared'

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage, plugin }) {
		// Rendered rows and components are cached
		if (plugin.startedLate) {
			plugin.requireReload()
			return
		}

		setStorage(jsonStorage)
		const reportError = (e: unknown) => plugin.reportError(e)

		cleanup(
			() => setStorage(undefined),
			patchRows(reportError),
			patchMentionAutocomplete(reportError),
			patchMemberList(reportError),
			patchVoiceUsers(reportError),
			patchTypingIndicator(reportError),
			patchReactors(reportError),
			patchPollResults(reportError),
		)
	},
	SettingsComponent,
})
