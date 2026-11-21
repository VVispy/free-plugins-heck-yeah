import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { Design } from '@valenced/discord/design'
import { ScrollView } from 'react-native'
import { DefaultSettings } from './shared'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './shared'

const { Stack, TableRowGroup, TableSwitchRow } = Design

type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>

export default function SettingsComponent({
	api: { jsonStorage: storage },
}: Props) {
	const settings = { ...DefaultSettings, ...storage.use() }

	return (
		<Page>
			<ScrollView>
				<Stack spacing={24}>
					<TableRowGroup
						title="Where to show role colors"
						description="Reopen a channel to update messages already on screen."
						hasIcons
					>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="AtIcon" />}
							label="Chat mentions"
							subLabel="Color user mentions in messages, replies and embeds."
							value={settings.chatMentions}
							onValueChange={chatMentions => storage.set({ chatMentions })}
						/>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="GroupIcon" />}
							label="Member list"
							subLabel="Color the role headers in the member list."
							value={settings.memberList}
							onValueChange={memberList => storage.set({ memberList })}
						/>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="PhoneCallIcon" />}
							label="Voice users"
							subLabel="Color the names of users in voice channels."
							value={settings.voiceUsers}
							onValueChange={voiceUsers => storage.set({ voiceUsers })}
						/>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="KeyboardIcon" />}
							label="Typing indicator"
							subLabel="Color the names of people who are typing."
							value={settings.typingIndicator}
							onValueChange={typingIndicator =>
								storage.set({ typingIndicator })
							}
						/>
						{settings.typingIndicator && (
							<TableSwitchRow
								icon={<TableRowAssetIcon name="NitroWheelIcon" />}
								label="Regular typing messages"
								subLabel="Show custom typing messages as regular ones. When off, names in custom messages are colored too."
								value={settings.regularTypingMessages}
								onValueChange={regularTypingMessages =>
									storage.set({ regularTypingMessages })
								}
							/>
						)}
					</TableRowGroup>
					<TableRowGroup title="Style" hasIcons>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="StarIcon" />}
							label="Gradient role colors"
							subLabel="Show gradients for roles with enhanced role colors, including names in chat. When off, the primary color is used."
							value={settings.gradients}
							onValueChange={gradients => storage.set({ gradients })}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
