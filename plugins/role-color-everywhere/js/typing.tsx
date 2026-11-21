import { Design } from '@valenced/discord/design'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { after, instead } from '@valenced/patcher'
import { cloneElement, isValidElement } from 'react'
import { paintInlineName } from './gradient'
import { replaceElement, wrapComponent } from './react'
import { getMemberColors, getSetting } from './shared'
import type { ReactElement, ReactNode } from 'react'

interface TypingProps {
	channel?: { guild_id?: string | null } | null
	typingUserIds?: string[]
}

type RenderItem = (...args: unknown[]) => ReactNode

interface TypingIndicatorModule {
	default: { type: (...args: unknown[]) => ReactNode }
	useTypingUserIdsForDisplay: unknown
}

interface CustomTypingIndicatorModule {
	getViewableCustomTypingIndicatorConfig(...args: unknown[]): unknown
	useCurrentCustomTypingIndicatorConfig: unknown
}

interface TypingTextProps {
	variant?: unknown
	children?: ReactNode
}

/**
 * <TypingIndicator channel={...}>
 *   <TransitionItem renderItem={...}>
 *     <TypingIndicatorInner channel={...} typingUserIds={[A, B]}>
 *       ...
 *         <Text variant="text-xs/medium">
 *           <Text>A</Text>, " and ", <Text>B</Text>, " are typing..."
 */
export function patchTypingIndicator(reportError: (e: unknown) => void) {
	const unpatches: (() => unknown)[] = []
	const patchedRenderItems = new WeakMap<RenderItem, RenderItem>()

	const transform = (tree: ReactNode, props: TypingProps) => {
		if (!getSetting('typingIndicator')) return tree

		try {
			return colorNames(tree, props)
		} catch (e) {
			reportError(e)
			return tree
		}
	}

	const unsubscribe = getModules(
		// modules/chat/native/TypingIndicator.tsx
		withProps<TypingIndicatorModule>('useTypingUserIdsForDisplay'),
		({ default: TypingIndicator }) => {
			unpatches.push(
				after(TypingIndicator, 'type', tree => {
					const item = tree as ReactElement<{ renderItem?: RenderItem }>
					const renderItem = item?.props?.renderItem
					if (typeof renderItem !== 'function') return tree

					let patched = patchedRenderItems.get(renderItem)
					if (!patched) {
						patched = (...args) => {
							const element = renderItem(...args)
							if (!isValidElement<TypingProps>(element)) return element

							const Inner = wrapComponent<TypingProps>(element.type, transform)
							return Inner ? (
								<Inner key={element.key} {...element.props} />
							) : (
								element
							)
						}
						patchedRenderItems.set(renderItem, patched)
					}

					// The element may be cached, so it's never mutated
					return cloneElement(item, { renderItem: patched })
				}),
			)
		},
		{ max: 1 },
	)

	// Custom typing messages (Nitro) are shown as regular ones, so their names are colored too
	const unsubscribeCustom = getModules(
		withProps<CustomTypingIndicatorModule>(
			'getViewableCustomTypingIndicatorConfig',
			'useCurrentCustomTypingIndicatorConfig',
		),
		module => {
			unpatches.push(
				instead(
					module,
					'getViewableCustomTypingIndicatorConfig',
					function (args, original) {
						return getSetting('typingIndicator')
							? null
							: Reflect.apply(original, this, args)
					},
				),
			)
		},
		{ max: 1 },
	)

	return () => {
		unsubscribe()
		unsubscribeCustom()
		for (const unpatch of unpatches) unpatch()
	}
}

function colorNames(tree: ReactNode, { channel, typingUserIds }: TypingProps) {
	const guildId = channel?.guild_id
	if (!guildId || !typingUserIds?.length) return tree

	// "Several people are typing..." has no names to color
	const isTypingText = (element: ReactElement<TypingTextProps>) =>
		element.type === Design.Text &&
		Array.isArray(element.props.children) &&
		element.props.children.filter(child => isValidElement(child)).length ===
			typingUserIds.length

	return replaceElement(tree, isTypingText, text => {
		const { children, variant } = text.props as TypingTextProps
		let index = 0

		const parts = (children as ReactNode[]).map(child => {
			if (!isValidElement<{ style?: unknown }>(child)) return child

			const colors = getMemberColors(guildId, typingUserIds[index++])
			return colors ? paintInlineName(child, colors, variant) : child
		})

		return cloneElement(text, undefined, ...parts)
	})
}
