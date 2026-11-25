import { isValidElement, useEffect, useSyncExternalStore } from 'react'
import { paintRowTree } from './gradient'
import { transformComponent, wrapListRenderItem } from './react'
import { PollGuildContext } from './reactions'
import {
	getColors,
	getGuildId,
	getMember,
	getSelectedChannelId,
	getSetting,
	noopSubscribe,
	requestMember,
	requestMembers,
	subscribeToMembers,
} from './shared'
import type { ReactNode } from 'react'

interface VotersListProps {
	channelId?: string
}

interface VoterRowProps {
	row: ReactNode
	userId: string
	guildId: string
}

const Snowflake = /^\d{15,22}$/

function toUserId(value: unknown): string | undefined {
	if (typeof value === 'string' && Snowflake.test(value)) return value
	if (typeof value === 'number' && Number.isFinite(value)) return String(value)
	return undefined
}

function extractUserIdFromItem(item: any): string | undefined {
	if (item == null) return undefined
	const direct = toUserId(item)
	if (direct) return direct
	if (typeof item !== 'object') return undefined

	return (
		toUserId(item.user?.id) ??
		toUserId(item.voter?.id) ??
		toUserId(item.member?.userId) ??
		toUserId(item.member?.id) ??
		toUserId(item.userId) ??
		toUserId(item.voterId) ??
		toUserId(item.id) ??
		toUserId(item.data?.user?.id) ??
		toUserId(item.data?.id) ??
		toUserId(item.record?.id)
	)
}

function findUserIdInNode(node: ReactNode, depth = 0): string | undefined {
	if (depth > 5 || node == null) return undefined

	if (Array.isArray(node)) {
		for (const child of node) {
			const id = findUserIdInNode(child, depth)
			if (id) return id
		}
		return undefined
	}

	if (!isValidElement<Record<string, any>>(node)) return undefined

	const props = node.props
	const direct =
		toUserId(props.user?.id) ??
		toUserId(props.userId) ??
		toUserId(props.member?.userId)
	if (direct) return direct

	return (
		findUserIdInNode(props.icon, depth + 1) ??
		findUserIdInNode(props.leading, depth + 1) ??
		findUserIdInNode(props.children, depth + 1)
	)
}

function extractUserId(item: any, row: ReactNode): string | undefined {
	return extractUserIdFromItem(item) ?? findUserIdInNode(row)
}

function collectListUserIds(node: ReactNode, out: Set<string>, depth = 0) {
	if (depth > 12 || node == null) return

	if (Array.isArray(node)) {
		for (const child of node) collectListUserIds(child, out, depth)
		return
	}

	if (!isValidElement<Record<string, any>>(node)) return

	const data = node.props.data
	if (Array.isArray(data)) {
		for (const item of data) {
			const id = extractUserIdFromItem(item)
			if (id) out.add(id)
		}
	}

	collectListUserIds(node.props.children, out, depth + 1)
}

function memberColorSnapshot(guildId: string, userId: string): string {
	const member = getMember(guildId, userId)
	if (!member) return ''
	const colors = getColors(guildId, member)
	if (!colors) return 'm'
	const g = colors.gradient
	return g
		? `${colors.color}|${g.primaryColor}|${g.secondaryColor}|${g.tertiaryColor ?? ''}`
		: colors.color
}

function ColoredPollVoterRow({ row, userId, guildId }: VoterRowProps) {
	const snapshot = useSyncExternalStore(
		guildId && userId ? subscribeToMembers : noopSubscribe,
		() => memberColorSnapshot(guildId, userId),
	)

	useEffect(() => {
		if (guildId && userId && !snapshot) requestMember(guildId, userId)
	}, [guildId, userId, snapshot])

	if (!getSetting('pollResults') || !snapshot || snapshot === 'm') return row

	const colors = getColors(guildId, getMember(guildId, userId))
	return colors ? paintRowTree(row, colors, true) : row
}

function useColoredVotersList(tree: ReactNode, { channelId }: VotersListProps) {
	const guildId = getGuildId(channelId ?? getSelectedChannelId())

	const ids = new Set<string>()
	if (guildId) collectListUserIds(tree, ids)
	const idsKey = Array.from(ids).join(',')

	useEffect(() => {
		if (!guildId || !idsKey) return
		const missing = idsKey
			.split(',')
			.filter(userId => !getMember(guildId, userId))
		if (missing.length) requestMembers(guildId, missing)
	}, [guildId, idsKey])

	if (!guildId) return tree

	const wrapped = wrapListRenderItem(
		tree,
		(row, info) => {
			const userId = extractUserId(info?.item, row)
			if (!userId) return row

			return (
				<ColoredPollVoterRow
					key={userId}
					row={row}
					userId={userId}
					guildId={guildId}
				/>
			)
		},
		12,
	)

	return (
		<PollGuildContext.Provider value={guildId}>
			{wrapped}
		</PollGuildContext.Provider>
	)
}

export function patchPollResults(reportError: (e: unknown) => void) {
	return transformComponent<VotersListProps>(
		'VotersList',
		() => getSetting('pollResults'),
		useColoredVotersList,
		reportError,
	)
}
