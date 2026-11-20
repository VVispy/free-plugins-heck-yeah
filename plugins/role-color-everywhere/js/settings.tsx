import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { Design } from '@valenced/discord/design'
import { ScrollView } from 'react-native'
import { DefaultSettings } from './shared'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './shared'

const { Slider, Stack, TableRow, TableRowGroup, TableSwitchRow, Text } = Design

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
					</TableRowGroup>
					<TableRowGroup title="Style" hasIcons>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="StarIcon" />}
							label="Gradient role colors"
							subLabel="Show gradients for roles with enhanced role colors. When off, the primary color is used."
							value={settings.gradients}
							onValueChange={gradients => storage.set({ gradients })}
						/>
					</TableRowGroup>
					<TableRowGroup title="Messages" hasIcons>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="ChatIcon" />}
							label="Color chat messages"
							subLabel="Tint message text with the author's role color."
							value={settings.colorChatMessages}
							onValueChange={colorChatMessages =>
								storage.set({ colorChatMessages })
							}
						/>
						{settings.colorChatMessages && (
							<TableRow
								icon={<TableRowAssetIcon name="PaintPaletteIcon" />}
								label="Message saturation"
								trailing={
									<Text variant="text-sm/medium" color="text-muted">
										{`${settings.messageSaturation}%`}
									</Text>
								}
								subLabel={
									<Stack spacing={8}>
										<Text variant="text-xs/medium" color="text-muted">
											Intensity of message coloring.
										</Text>
										<Slider
											step={10}
											minimumValue={0}
											maximumValue={100}
											value={settings.messageSaturation}
											onValueChange={messageSaturation =>
												storage.set({ messageSaturation })
											}
										/>
									</Stack>
								}
							/>
						)}
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
