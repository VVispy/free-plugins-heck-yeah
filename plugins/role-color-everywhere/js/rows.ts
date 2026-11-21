import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { after } from '@valenced/patcher'
import { getErrorStack } from '@valenced/utils/error'
import { getMemberColors, getSetting, hexToInt } from './shared'
import type { RoleColors } from './shared'

interface RowManager {
	prototype: {
		generate(args: unknown): MessageRow
	}
}

interface MessageRow {
	type?: number
	message?: RowMessage
}

interface RowMessage {
	guildId?: string | null
	content?: ContentNode[]
	embeds?: { description?: unknown }[]
	/** Gradient of the author's name */
	roleColors?: NativeRoleColors | null
	referencedMessage?: { message?: RowMessage }
}

interface ContentNode {
	type?: string
	content?: unknown
	items?: ContentNode[][]
	userId?: string
	guildId?: string | null
	roleColor?: number
	roleColors?: NativeRoleColors | null
	color?: number
	colorString?: string
}

/** Gradient stops as RGB integers, like Discord's own role mentions */
interface NativeRoleColors {
	primaryColor: number
	secondaryColor: number
	tertiaryColor?: number
}

interface Options {
	guildId: string
	/** Colors user mentions */
	color: boolean
	/** Removes gradients Discord adds itself */
	strip: boolean
}

const MessageRowType = 1

export function patchRows(reportError: (e: unknown) => void) {
	const unpatches: (() => unknown)[] = []

	const unsubscribe = getModules(
		// modules/messages/native/renderer/RowGenerator.tsx
		withName<RowManager>('RowManager'),
		({ prototype }) => {
			unpatches.push(
				after(prototype, 'generate', row => {
					const message = row?.type === MessageRowType ? row.message : undefined
					if (!message?.guildId) return row

					try {
						const options: Options = {
							guildId: message.guildId,
							color: getSetting('chatMentions'),
							strip: !getSetting('gradients'),
						}

						styleMessage(message, options)

						const reply = message.referencedMessage?.message
						if (reply)
							styleMessage(reply, {
								...options,
								guildId: reply.guildId ?? options.guildId,
							})
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

function styleMessage(message: RowMessage, options: Options) {
	if (options.strip && message.roleColors) message.roleColors = null
	if (!options.color && !options.strip) return

	if (message.content) message.content = withColors(message.content, options)
	if (!message.embeds?.length) return

	let changed = false
	const embeds = message.embeds.map(embed => {
		if (!Array.isArray(embed?.description)) return embed

		const description = withColors(embed.description, options)
		if (description === embed.description) return embed

		changed = true
		return { ...embed, description }
	})

	if (changed) message.embeds = embeds
}

// Discord caches parsed nodes, so they're copied
function withColors(nodes: ContentNode[], options: Options): ContentNode[] {
	let changed = false

	const result = nodes.map(node => {
		const updated = withColor(node, options)
		if (updated !== node) changed = true
		return updated
	})

	return changed ? result : nodes
}

function withColor(node: ContentNode, options: Options): ContentNode {
	if (!node || typeof node !== 'object') return node

	if (node.type === 'mention') {
		if (options.color && node.userId) {
			const colors = getMemberColors(
				node.guildId ?? options.guildId,
				node.userId,
			)

			if (colors) {
				const color = hexToInt(colors.color)
				node = {
					...node,
					roleColor: color,
					color,
					colorString: colors.color,
				}
				if (colors.gradient) node.roleColors = toNativeColors(colors.gradient)
			}
		}

		// Role mentions come with Discord's own gradient
		if (options.strip && node.roleColors) node = { ...node, roleColors: null }

		return node
	}

	// Formatting nodes can hold mentions too
	if (Array.isArray(node.content)) {
		const content = withColors(node.content, options)
		if (content !== node.content) node = { ...node, content }
	}

	if (Array.isArray(node.items)) {
		const items = node.items.map(item => withColors(item, options))
		if (items.some((item, i) => item !== node.items![i]))
			node = { ...node, items }
	}

	return node
}

function toNativeColors({
	primaryColor,
	secondaryColor,
	tertiaryColor,
}: NonNullable<RoleColors['gradient']>): NativeRoleColors {
	const colors: NativeRoleColors = {
		primaryColor: hexToInt(primaryColor),
		secondaryColor: hexToInt(secondaryColor),
	}
	if (tertiaryColor) colors.tertiaryColor = hexToInt(tertiaryColor)
	return colors
}
