import { Design } from '@valenced/discord/design'
import { cloneElement } from 'react'
import { paintText } from './gradient'
import { replaceElement, transformComponent } from './react'
import { getColors, getRoles, getSelectedGuildId, getSetting } from './shared'
import type { Role } from './shared'

interface UserSectionProps {
	title?: unknown
	guildId?: string
}

export const StockHeaderSizeIndex = 2

export const HeaderSizeLabels = [
	'Ant-Sized',
	'Squintable',
	'Stock',
	'Big',
	'Overcompensating',
] as const

const HeaderSizeStyles: Record<
	number,
	{ fontSize: number; lineHeight: number } | undefined
> = {
	0: { fontSize: 12, lineHeight: 16 },
	1: { fontSize: 14, lineHeight: 18 },
	2: undefined,
	3: { fontSize: 18, lineHeight: 24 },
	4: { fontSize: 22, lineHeight: 28 },
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

			const sizeStyle = HeaderSizeStyles[getSetting('memberListHeaderSize')]
			const weightStyle = getSetting('memberListBoldHeaders')
				? ({ fontWeight: 'bold' } as const)
				: ({ fontWeight: 'normal' } as const)

			const styledTree = replaceElement(
				tree,
				element => element.type === Design.Text,
				text =>
					cloneElement(text, {
						style: [text.props?.style, sizeStyle, weightStyle],
					}),
			)

			const colors = getColors(guildId, findRole(guildId, title))
			return colors ? paintText(styledTree, colors) : styledTree
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
