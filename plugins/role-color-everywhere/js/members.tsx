import { beforeJSX } from '@valenced/react/jsx-runtime'
import { Text } from 'react-native'
import { onComponentType } from './react'
import { getRoles, getSelectedGuildId, getSetting } from './shared'
import type { FC } from 'react'
import type { Role } from './shared'

interface UserSectionProps {
	title?: unknown
	guildId?: string
}

// Trailing member count, like "Moderator — 12"
const MemberCount = /\s*[—–-]\s*[\d\s.,\u00a0\u202f]+$/

/**
 * Colors the member list role headers.
 * Only the formatted title reaches the header, so the role is matched by name.
 */
export function patchMemberList(reportError: (e: unknown) => void) {
	let unpatch: (() => unknown) | undefined

	const stop = onComponentType('UserSectionInner', type => {
		unpatch = beforeJSX(type as FC<UserSectionProps>, args => {
			const [, props] = args
			if (!getSetting('memberList') || typeof props?.title !== 'string')
				return args

			try {
				const guildId = props.guildId ?? getSelectedGuildId()
				const color = guildId && findRole(guildId, props.title)?.colorString
				if (!color) return args

				const title = <Text style={{ color }}>{props.title}</Text>
				return [args[0], { ...props, title }, ...args.slice(2)] as typeof args
			} catch (e) {
				reportError(e)
				return args
			}
		})
	})

	return () => {
		stop()
		unpatch?.()
	}
}

function findRole(guildId: string, title: string): Role | undefined {
	const label = title.replace(MemberCount, '').trim()
	if (!label) return

	const lower = label.toLowerCase()
	let best: Role | undefined

	for (const role of getRoles(guildId)) {
		if (!role?.colorString || !role.name) continue
		if (role.name === label) return role

		// Headers can start with the role icon
		const name = role.name.toLowerCase()
		if (
			(lower === name || lower.endsWith(` ${name}`)) &&
			(!best || role.name.length > best.name.length)
		)
			best = role
	}

	return best
}
