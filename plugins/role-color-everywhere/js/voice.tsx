import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { cloneElement, isValidElement } from 'react'
import { componentName, replaceElement, wrapComponent } from './react'
import { getGuildIdOfChannel, getMemberColor, getSetting } from './shared'
import type { FC, ReactNode } from 'react'

interface VoiceUserProps {
	member?: { colorString?: string | null } | null
	user?: { id: string } | null
	guildId?: string | null
	channel?: { id: string; guild_id?: string | null } | null
}

// Read by the wrapped inner component only
const ColorProp = '__roleColorEverywhere'

type InnerProps = { [ColorProp]?: string }

/**
 * <VoiceUserConnected member={...} user={...}>
 *   <Inner>
 *     ...
 *       <VoiceUserNameItem color={...} />
 */
export function patchVoiceUsers(reportError: (e: unknown) => void) {
	const unpatches: (() => unknown)[] = []

	const unsubscribe = getModules(
		withName<FC<VoiceUserProps>>('VoiceUserConnected'),
		module => {
			const target = module as unknown as { default?: FC<VoiceUserProps> }
			if (typeof target.default !== 'function') return

			unpatches.push(
				instead(
					target as { default: FC<VoiceUserProps> },
					'default',
					function (args, original) {
						const tree = Reflect.apply(original, this, args) as ReactNode
						if (!getSetting('voiceUsers') || !isValidElement<InnerProps>(tree))
							return tree

						try {
							const [props] = args
							const color =
								props?.member?.colorString ||
								getMemberColor(
									props?.guildId ??
										props?.channel?.guild_id ??
										getGuildIdOfChannel(props?.channel?.id),
									props?.user?.id,
								)
							if (!color) return tree

							const Inner = wrapComponent<InnerProps>(tree.type, colorName)
							if (!Inner) return tree

							return (
								<Inner
									key={tree.key}
									{...tree.props}
									{...{ [ColorProp]: color }}
								/>
							)
						} catch (e) {
							reportError(e)
							return tree
						}
					},
				),
			)
		},
		{ returnNamespace: true },
	)

	return () => {
		unsubscribe()
		for (const unpatch of unpatches) unpatch()
	}
}

function colorName(tree: ReactNode, props: InnerProps) {
	const color = props[ColorProp]
	if (!color) return tree

	return replaceElement(
		tree,
		element => componentName(element.type) === 'VoiceUserNameItem',
		element => cloneElement(element, { color }),
	)
}
