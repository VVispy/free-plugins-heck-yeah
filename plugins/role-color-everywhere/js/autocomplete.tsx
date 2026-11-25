import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { beforeJSX } from '@valenced/react/jsx-runtime'
import { useEffect, useSyncExternalStore } from 'react'
import { paintRowTree } from './gradient'
import { wrapComponent } from './react'
import { AutocompleteGuildContext } from './reactions'
import {
	getColors,
	getGuildId,
	getMember,
	getRole,
	getSelectedChannelId,
	getSetting,
	noopSubscribe,
	requestMember,
	subscribeToMembers,
} from './shared'
import type { FC, ReactNode } from 'react'
import type { Colored, Role } from './shared'

interface GuildScopedProps {
	guildId?: string | null
	channelId?: string | null
	channel?: { guild_id?: string | null } | null
}

interface AutocompleteUserProps extends GuildScopedProps {
	user?: { id?: string } | null
	id?: string
	userId?: string
	member?: Colored | null
}

interface AutocompleteRoleProps extends GuildScopedProps, Colored {
	role?: Role | null
	id?: string
}

function resolveGuildId(props: GuildScopedProps) {
	return (
		props.guildId ??
		props.channel?.guild_id ??
		getGuildId(props.channelId ?? getSelectedChannelId())
	)
}

function useColoredUserRow(tree: ReactNode, props: AutocompleteUserProps) {
	const guildId = resolveGuildId(props)
	const userId = props.user?.id ?? props.id ?? props.userId

	const storedMember = useSyncExternalStore(
		guildId && userId ? subscribeToMembers : noopSubscribe,
		() => getMember(guildId, userId),
	)

	useEffect(() => {
		if (guildId && userId && !storedMember) requestMember(guildId, userId)
	}, [guildId, userId, storedMember])

	if (!getSetting('mentionAutocomplete') || !tree) return tree

	const colors = getColors(guildId, storedMember ?? props.member)
	const colored = colors ? paintRowTree(tree, colors) : tree

	return guildId ? (
		<AutocompleteGuildContext.Provider value={guildId}>
			{colored}
		</AutocompleteGuildContext.Provider>
	) : (
		colored
	)
}

function transformRoleRow(tree: ReactNode, props: AutocompleteRoleProps) {
	if (!getSetting('mentionAutocomplete') || !tree) return tree

	const guildId = resolveGuildId(props)
	const roleProp = props.role ?? props
	const role =
		(roleProp?.id ? getRole(guildId, roleProp.id) : undefined) ?? roleProp
	const colors = getColors(guildId, role)

	return colors ? paintRowTree(tree, colors) : tree
}

export function patchMentionAutocomplete(reportError: (e: unknown) => void) {
	const unpatches: (() => unknown)[] = []

	const safeUser = (tree: ReactNode, props: AutocompleteUserProps) => {
		try {
			return useColoredUserRow(tree, props)
		} catch (e) {
			reportError(e)
			return tree
		}
	}

	const safeRole = (tree: ReactNode, props: AutocompleteRoleProps) => {
		try {
			return transformRoleRow(tree, props)
		} catch (e) {
			reportError(e)
			return tree
		}
	}

	const unsubscribe = getModules(
		withProps<{
			AUTOCOMPLETE_STICKER_NODE_SIZE: unknown
			AUTOCOMPLETE_STICKER_NODE_MARGIN: unknown
			default?: {
				User?: FC<AutocompleteUserProps>
				Role?: FC<AutocompleteRoleProps>
			}
		}>('AUTOCOMPLETE_STICKER_NODE_SIZE', 'AUTOCOMPLETE_STICKER_NODE_MARGIN'),
		mod => {
			const renderers = mod?.default
			if (!renderers || typeof renderers !== 'object') return

			if (renderers.User) {
				const User = renderers.User
				unpatches.push(
					beforeJSX(User, args => {
						if (!getSetting('mentionAutocomplete')) return args
						const Wrapped = wrapComponent<AutocompleteUserProps>(User, safeUser)
						return Wrapped
							? ([Wrapped, ...args.slice(1)] as unknown as typeof args)
							: args
					}),
				)
			}

			if (renderers.Role) {
				const Role = renderers.Role
				unpatches.push(
					beforeJSX(Role, args => {
						if (!getSetting('mentionAutocomplete')) return args
						const Wrapped = wrapComponent<AutocompleteRoleProps>(Role, safeRole)
						return Wrapped
							? ([Wrapped, ...args.slice(1)] as unknown as typeof args)
							: args
					}),
				)
			}
		},
		{ max: 1 },
	)

	return () => {
		unsubscribe()
		for (const unpatch of unpatches) unpatch()
	}
}
