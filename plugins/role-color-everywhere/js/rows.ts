import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { getErrorStack } from '@valenced/utils/error'
import {
	getMemberColor,
	getSetting,
	hexToInt,
	mixWithTextColor,
} from './shared'

interface GenerateArgs {
	message?: { state?: string }
}

interface RowManager {
	prototype: {
		generate(args: GenerateArgs): MessageRow
	}
}

interface MessageRow {
	type?: number
	message?: RowMessage
}

interface RowMessage {
	guildId?: string | null
	authorId?: string
	content?: ContentNode[]
	embeds?: { description?: unknown }[]
	/** Text & guild tag color */
	textColor?: number
	referencedMessage?: { message?: RowMessage }
}

interface ContentNode {
	type?: string
	content?: unknown
	items?: ContentNode[][]
	userId?: string
	guildId?: string | null
	roleColor?: number
	color?: number
	colorString?: string
}

const MessageRowType = 1
const SendFailedState = 'SEND_FAILED'

export function patchRows(reportError: (e: unknown) => void) {
	const unpatches: (() => unknown)[] = []

	const unsubscribe = getModules(
		// modules/messages/native/renderer/RowGenerator.tsx
		withName<RowManager>('RowManager'),
		({ prototype }) => {
			unpatches.push(
				instead(prototype, 'generate', function (args, original) {
					const row = Reflect.apply(original, this, args) as MessageRow
					const message = row?.type === MessageRowType ? row.message : undefined
					if (!message) return row

					try {
						styleMessage(message, args[0]?.message?.state)
					} catch (e) {
						reportError(`Failed to color message row: ${getErrorStack(e)}`)
					}

					return row
				}),
			)
		},
	)

	return () => {
		unsubscribe()
		for (const unpatch of unpatches) unpatch()
	}
}

function styleMessage(message: RowMessage, state: string | undefined) {
	const { guildId } = message
	if (!guildId) return

	if (getSetting('chatMentions')) {
		colorMentionsIn(message, guildId)

		const reply = message.referencedMessage?.message
		if (reply) colorMentionsIn(reply, reply.guildId ?? guildId)
	}

	// Failed messages stay distinguishable
	if (!getSetting('colorChatMessages') || state === SendFailedState) return

	const saturation = getSetting('messageSaturation')
	const color = saturation > 0 && getMemberColor(guildId, message.authorId)
	if (!color) return

	const textColor = mixWithTextColor(color, saturation)
	if (textColor !== undefined) message.textColor = textColor
}

function colorMentionsIn(message: RowMessage, guildId: string) {
	if (message.content) message.content = withColors(message.content, guildId)

	if (!message.embeds?.length) return

	let changed = false
	const embeds = message.embeds.map(embed => {
		if (!Array.isArray(embed?.description)) return embed

		const description = withColors(embed.description, guildId)
		if (description === embed.description) return embed

		changed = true
		return { ...embed, description }
	})

	if (changed) message.embeds = embeds
}

// Discord caches parsed nodes, so they're copied
function withColors(nodes: ContentNode[], guildId: string): ContentNode[] {
	let changed = false

	const result = nodes.map(node => {
		const updated = withColor(node, guildId)
		if (updated !== node) changed = true
		return updated
	})

	return changed ? result : nodes
}

function withColor(node: ContentNode, guildId: string): ContentNode {
	if (!node || typeof node !== 'object') return node

	if (node.type === 'mention') {
		if (!node.userId) return node

		const colorString = getMemberColor(node.guildId ?? guildId, node.userId)
		if (!colorString) return node

		const color = hexToInt(colorString)
		return { ...node, roleColor: color, color, colorString }
	}

	// Formatting nodes can hold mentions too
	if (Array.isArray(node.content)) {
		const content = withColors(node.content, guildId)
		if (content !== node.content) node = { ...node, content }
	}

	if (Array.isArray(node.items)) {
		const items = node.items.map(item => withColors(item, guildId))
		if (items.some((item, i) => item !== node.items![i]))
			node = { ...node, items }
	}

	return node
}
