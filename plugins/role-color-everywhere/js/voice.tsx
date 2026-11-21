import { cloneElement, isValidElement } from 'react'
import { paintText } from './gradient'
import { transformComponent } from './react'
import {
	getColors,
	getMemberColors,
	getSetting,
	getVoiceGuildId,
} from './shared'
import type { ReactNode } from 'react'
import type { Colored } from './shared'

interface VoiceUserNameProps {
	guildId?: string | null
	member?: Colored | null
}

interface MemberRowProps {
	guildId?: string | null
	user?: { id: string } | null
}

interface ParticipantLabelProps {
	participant?: { user?: { id: string } | null } | null
}

const enabled = () => getSetting('voiceUsers')

export function patchVoiceUsers(reportError: (e: unknown) => void) {
	const unpatches = [
		/**
		 * Channel list
		 *
		 * <VoiceUserNameItem member={...} guildId={...} color="redesign-channel-name-text">
		 *   <View>
		 *     <Text variant="text-sm/medium" color="redesign-channel-name-text">name</Text>
		 */
		transformComponent<VoiceUserNameProps>(
			'VoiceUserNameItem',
			enabled,
			(tree, { guildId, member }) => {
				const colors = getColors(guildId, member)
				return colors ? paintText(tree, colors) : tree
			},
			reportError,
		),
		/**
		 * Voice channel sheet
		 *
		 * <MemberRowItem user={...} guildId={...}>
		 *   <TableRow label={<View><Text variant="text-md/semibold">name</Text></View>} />
		 */
		transformComponent<MemberRowProps>(
			'MemberRowItem',
			enabled,
			(tree, { guildId, user }) => {
				if (
					!isValidElement<{ label?: ReactNode }>(tree) ||
					tree.props.label == null
				)
					return tree

				const colors = getMemberColors(guildId, user?.id)
				return colors
					? cloneElement(tree, { label: paintText(tree.props.label, colors) })
					: tree
			},
			reportError,
		),
		/**
		 * Call grid tiles
		 *
		 * <FloatingParticipantLabel participant={...} label="name">
		 *   ...
		 *     <Text variant="heading-sm/semibold" color="text-overlay-light">name</Text>
		 */
		transformComponent<ParticipantLabelProps>(
			'FloatingParticipantLabel',
			enabled,
			(tree, { participant }) => {
				const colors = getMemberColors(getVoiceGuildId(), participant?.user?.id)
				return colors ? paintText(tree, colors) : tree
			},
			reportError,
		),
	]

	return () => {
		for (const unpatch of unpatches) unpatch()
	}
}
