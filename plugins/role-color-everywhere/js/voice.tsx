import { beforeJSX } from '@valenced/react/jsx-runtime'
import { paintText } from './gradient'
import { onComponentType, wrapComponent } from './react'
import { getColors, getSetting } from './shared'
import type { FC, ReactNode } from 'react'
import type { Colored } from './shared'

interface VoiceUserNameProps {
	guildId?: string | null
	member?: Colored | null
}

/**
 * <VoiceUserItem member={...}>
 *   <VoiceUserNameItem member={...} guildId={...} color="redesign-channel-name-text">
 *     <View>
 *       <Text variant="text-sm/medium" color="redesign-channel-name-text">name</Text>
 */
export function patchVoiceUsers(reportError: (e: unknown) => void) {
	let unpatch: (() => unknown) | undefined

	const transform = (tree: ReactNode, props: VoiceUserNameProps) => {
		try {
			const colors = getColors(props.guildId, props.member)
			return colors ? paintText(tree, colors) : tree
		} catch (e) {
			reportError(e)
			return tree
		}
	}

	const stop = onComponentType('VoiceUserNameItem', type => {
		unpatch = beforeJSX(type as FC<VoiceUserNameProps>, args => {
			if (!getSetting('voiceUsers')) return args

			const Wrapped = wrapComponent<VoiceUserNameProps>(type, transform)
			return Wrapped
				? ([Wrapped, ...args.slice(1)] as unknown as typeof args)
				: args
		})
	})

	return () => {
		stop()
		unpatch?.()
	}
}
