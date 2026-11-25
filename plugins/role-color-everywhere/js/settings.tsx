import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { Design } from '@valenced/discord/design'
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { HeaderSizeLabels, StockHeaderSizeIndex } from './members'
import { DefaultSettings } from './shared'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './shared'

const { Button, Slider, Stack, TableRow, TableRowGroup, TableSwitchRow, Text } =
	Design

const headerRowStyle = {
	flexDirection: 'row',
	alignItems: 'center',
	justifyContent: 'space-between',
} as const

type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>

export default function SettingsComponent({
	api: { jsonStorage: storage },
}: Props) {
	const settings = { ...DefaultSettings, ...storage.use() }
	const savedSizeIndex = Math.max(
		0,
		Math.min(
			HeaderSizeLabels.length - 1,
			Math.round(settings.memberListHeaderSize),
		),
	)
	const [dragSize, setDragSize] = useState<number | null>(null)
	const activeSizeIndex = dragSize ?? savedSizeIndex

	const setHeaderSize = (index: number) => {
		const clamped = Math.max(
			0,
			Math.min(HeaderSizeLabels.length - 1, Math.round(index)),
		)
		setDragSize(null)
		storage.set({ memberListHeaderSize: clamped })
	}

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
							icon={<TableRowAssetIcon name="ChatIcon" />}
							label="Chat mentions"
							subLabel="Color user mentions in messages, replies and embeds."
							value={settings.chatMentions}
							onValueChange={chatMentions => storage.set({ chatMentions })}
						/>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="AtIcon" />}
							label="Mention autocomplete"
							subLabel="Color user and role suggestions when typing @."
							value={settings.mentionAutocomplete}
							onValueChange={mentionAutocomplete =>
								storage.set({ mentionAutocomplete })
							}
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
							icon={<TableRowAssetIcon name="ReactionIcon" />}
							label="Reactions list"
							subLabel="Color names in the list of people who reacted."
							value={settings.reactorsList}
							onValueChange={reactorsList => storage.set({ reactorsList })}
						/>
						<TableSwitchRow
							icon={<TableRowAssetIcon name="PollsIcon" />}
							label="Poll results"
							subLabel="Color the names of voters in poll results."
							value={settings.pollResults}
							onValueChange={pollResults => storage.set({ pollResults })}
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
					{settings.memberList && (
						<TableRowGroup title="Member list">
							<TableRow
								label={
									<Stack spacing={14}>
										<View style={headerRowStyle}>
											<Text variant="text-md/semibold">Role header size</Text>
											<Text variant="text-md/medium" color="text-muted">
												{HeaderSizeLabels[activeSizeIndex]}
											</Text>
										</View>
										<Slider
											minimumValue={0}
											maximumValue={HeaderSizeLabels.length - 1}
											step={1}
											value={activeSizeIndex}
											onValueChange={val => setDragSize(Math.round(val))}
											onSlidingComplete={setHeaderSize}
											startIcon={
												<Pressable
													onPress={() => setHeaderSize(activeSizeIndex - 1)}
												>
													<TableRowAssetIcon name="CircleMinusIcon-primary" />
												</Pressable>
											}
											endIcon={
												<Pressable
													onPress={() => setHeaderSize(activeSizeIndex + 1)}
												>
													<TableRowAssetIcon name="CirclePlusIcon-primary" />
												</Pressable>
											}
										/>
										<Button
											variant="secondary"
											size="md"
											text="Reset to default"
											disabled={activeSizeIndex === StockHeaderSizeIndex}
											onPress={() => setHeaderSize(StockHeaderSizeIndex)}
										/>
									</Stack>
								}
							/>
							<TableSwitchRow
								label="Bold role headers"
								subLabel="Make role headers in the member list bold."
								value={settings.memberListBoldHeaders}
								onValueChange={memberListBoldHeaders =>
									storage.set({ memberListBoldHeaders })
								}
							/>
						</TableRowGroup>
					)}
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
