import { Design } from '@valenced/discord/design'
import {
	cloneElement,
	createContext,
	useContext,
	useEffect,
	useSyncExternalStore,
} from 'react'
import { paintText } from './gradient'
import { replaceElement, transformComponent } from './react'
import {
	getColors,
	getGuildIdOfChannel,
	getMember,
	getSetting,
	noopSubscribe,
	requestMember,
	subscribeToMembers,
} from './shared'
import type { ReactNode } from 'react'

interface ReactionsContentProps {
	channelId?: string
}

interface DiscordTagProps {
	user?: { id: string } | null
}

// Rows aren't told their guild, so the sheet passes it down
const ReactionsGuildContext = createContext<string | undefined>(undefined)
export const PollGuildContext = createContext<string | undefined>(undefined)
export const AutocompleteGuildContext = createContext<string | undefined>(
	undefined,
)

const AutocompleteTagStyle = { fontSize: 12, lineHeight: 16 } as const

/**
 * <DiscordTag user={...} nick="name">
 *   <View>
 *     <Text variant="text-md/semibold">name</Text>
 */
function useColoredTag(tree: ReactNode, { user }: DiscordTagProps) {
	const reactionsGuildId = useContext(ReactionsGuildContext)
	const pollGuildId = useContext(PollGuildContext)
	const autocompleteGuildId = useContext(AutocompleteGuildContext)

	const reactionsActive = Boolean(
		reactionsGuildId && getSetting('reactorsList'),
	)
	const pollActive = Boolean(pollGuildId && getSetting('pollResults'))
	const autocompleteActive = Boolean(
		autocompleteGuildId && getSetting('mentionAutocomplete'),
	)
	const guildId =
		(reactionsActive ? reactionsGuildId : undefined) ??
		(pollActive ? pollGuildId : undefined) ??
		(autocompleteActive ? autocompleteGuildId : undefined)
	const userId = user?.id

	// Most reactors aren't loaded yet, so the name is colored once its member arrives
	const member = useSyncExternalStore(
		guildId && userId ? subscribeToMembers : noopSubscribe,
		() => getMember(guildId, userId),
	)

	useEffect(() => {
		if (guildId && userId && !member) requestMember(guildId, userId)
	}, [guildId, userId, member])

	const isAutocomplete = autocompleteActive && !reactionsActive && !pollActive
	const sizedTree = isAutocomplete
		? replaceElement(
				tree,
				element => element.type === Design.Text,
				text =>
					cloneElement(text, {
						style: [text.props?.style, AutocompleteTagStyle],
					}),
			)
		: tree

	const colors = getColors(guildId, member)
	return colors ? paintText(sizedTree, colors) : sizedTree
}

/**
 * <MessageReactionsContent channelId={...} messageId={...}>
 *   ...
 *     <FormRow leading={<Avatar />} label={<DiscordTag user={...} nick={...} />} />
 */
export function patchReactors(reportError: (e: unknown) => void) {
	const unpatches = [
		transformComponent<ReactionsContentProps>(
			'MessageReactionsContent',
			() => getSetting('reactorsList'),
			(tree, { channelId }) => (
				<ReactionsGuildContext.Provider value={getGuildIdOfChannel(channelId)}>
					{tree}
				</ReactionsGuildContext.Provider>
			),
			reportError,
		),
		// Only colored inside sheets/autocomplete where a guild context is set
		transformComponent<DiscordTagProps>(
			'DiscordTag',
			() =>
				getSetting('reactorsList') ||
				getSetting('pollResults') ||
				getSetting('mentionAutocomplete'),
			useColoredTag,
			reportError,
		),
	]

	return () => {
		for (const unpatch of unpatches) unpatch()
	}
}
