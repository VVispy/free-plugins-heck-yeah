import { createContext, useContext } from 'react'
import { paintText } from './gradient'
import { transformComponent } from './react'
import { getGuildIdOfChannel, getMemberColors, getSetting } from './shared'
import type { ReactNode } from 'react'

interface ReactionsContentProps {
	channelId?: string
}

interface DiscordTagProps {
	user?: { id: string } | null
}

// Rows aren't told their guild, so the sheet passes it down
const ReactionsGuildContext = createContext<string | undefined>(undefined)

const enabled = () => getSetting('reactorsList')

/**
 * <DiscordTag user={...} nick="name">
 *   <View>
 *     <Text variant="text-md/semibold">name</Text>
 */
function useColoredTag(tree: ReactNode, { user }: DiscordTagProps) {
	const guildId = useContext(ReactionsGuildContext)
	const colors = getMemberColors(guildId, user?.id)
	return colors ? paintText(tree, colors) : tree
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
			enabled,
			(tree, { channelId }) => (
				<ReactionsGuildContext.Provider value={getGuildIdOfChannel(channelId)}>
					{tree}
				</ReactionsGuildContext.Provider>
			),
			reportError,
		),
		// Only colored inside the reactions sheet, where the context is set
		transformComponent<DiscordTagProps>(
			'DiscordTag',
			enabled,
			useColoredTag,
			reportError,
		),
	]

	return () => {
		for (const unpatch of unpatches) unpatch()
	}
}
