import { paintText } from './gradient'
import { transformComponent } from './react'
import { getColors, getRoles, getSelectedGuildId, getSetting } from './shared'
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
 *
 * <UserSectionInner title="Moderator — 5">
 *   <View>
 *     <Text variant="text-md/medium" color="text-subtle">Moderator — 5</Text>
 */
export function patchMemberList(reportError: (e: unknown) => void) {
	return transformComponent<UserSectionProps>(
		'UserSectionInner',
		() => getSetting('memberList'),
		(tree, { title, guildId = getSelectedGuildId() }) => {
			if (typeof title !== 'string' || !guildId) return tree

			const colors = getColors(guildId, findRole(guildId, title))
			return colors ? paintText(tree, colors) : tree
		},
		reportError,
	)
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
