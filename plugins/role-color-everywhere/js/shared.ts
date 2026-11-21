import { Stores } from '@valenced/discord/flux'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'

export interface Settings {
	chatMentions: boolean
	memberList: boolean
	voiceUsers: boolean
	reactorsList: boolean
	typingIndicator: boolean
	/** Shows custom typing messages (Nitro) as regular ones */
	regularTypingMessages: boolean
	/** Gradients for roles with enhanced role colors */
	gradients: boolean
}

export const DefaultSettings: Settings = {
	chatMentions: true,
	memberList: true,
	voiceUsers: true,
	reactorsList: true,
	typingIndicator: true,
	regularTypingMessages: true,
	gradients: true,
}

let storage: JsonStorage<Settings> | undefined

export function setStorage(s: JsonStorage<Settings> | undefined) {
	storage = s
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
	return (
		(storage?.cache as Partial<Settings> | undefined)?.[key] ??
		DefaultSettings[key]
	)
}

export interface ColorStrings {
	primaryColor: string
	secondaryColor?: string | null
	tertiaryColor?: string | null
}

/** Guild member or role */
export interface Colored {
	colorString?: string | null
	colorStrings?: ColorStrings | null
}

export interface Role extends Colored {
	id: string
	name: string
}

export interface RoleColors {
	/** Solid color, the primary color of a gradient */
	color: string
	/** Set for enhanced role colors when gradients are enabled */
	gradient?: ColorStrings & { secondaryColor: string }
}

type Store<T> = DiscordModules.Flux.Store<T>

const EnhancedRoleColors = 'ENHANCED_ROLE_COLORS'

const getGuildStore = () =>
	Stores.GuildStore as Store<{
		getGuild(id: string):
			| {
					features?: {
						has?(feature: string): boolean
						includes?(feature: string): boolean
					}
			  }
			| undefined
	}>

const getGuildMemberStore = () =>
	Stores.GuildMemberStore as Store<{
		getMember(guildId: string, userId: string): Colored | null | undefined
	}>

const getGuildRoleStore = () =>
	Stores.GuildRoleStore as
		| Store<{
				getSortedRoles?(guildId: string): Role[] | undefined
				getRolesSnapshot?(guildId: string): Record<string, Role> | undefined
		  }>
		| undefined

const getSelectedGuildStore = () =>
	Stores.SelectedGuildStore as Store<{
		getGuildId(): string | null | undefined
	}>

const getSelectedChannelStore = () =>
	Stores.SelectedChannelStore as Store<{
		getVoiceChannelId(): string | null | undefined
	}>

const getChannelStore = () =>
	Stores.ChannelStore as Store<{
		getChannel(id: string): { guild_id?: string | null } | undefined
	}>

export function getGuildIdOfChannel(channelId: string | null | undefined) {
	return (
		(channelId && getChannelStore().getChannel(channelId)?.guild_id) ||
		undefined
	)
}

/**
 * Returns the guild of the voice channel the user is connected to.
 */
export function getVoiceGuildId() {
	return getGuildIdOfChannel(getSelectedChannelStore().getVoiceChannelId())
}

function hasEnhancedRoleColors(guildId: string) {
	const features = getGuildStore().getGuild(guildId)?.features
	return !!(
		features?.has?.(EnhancedRoleColors) ??
		features?.includes?.(EnhancedRoleColors)
	)
}

/**
 * Returns the colors of a guild member or role.
 */
export function getColors(
	guildId: string | null | undefined,
	source: Colored | null | undefined,
): RoleColors | undefined {
	const color = source?.colorString
	if (!color) return

	const strings = source.colorStrings
	if (
		!guildId ||
		!strings?.secondaryColor ||
		!getSetting('gradients') ||
		!hasEnhancedRoleColors(guildId)
	)
		return { color }

	return { color, gradient: strings as RoleColors['gradient'] }
}

/**
 * Subscribes to guild member changes.
 *
 * @returns A function to unsubscribe.
 */
export function subscribeToMembers(callback: () => void) {
	const store = getGuildMemberStore()
	store.addChangeListener(callback)
	return () => store.removeChangeListener(callback)
}

/**
 * Asks Discord to load a guild member. Requests are batched and deduplicated by Discord.
 */
export function requestMember(guildId: string, userId: string) {
	const store = Stores.GuildMemberRequesterStore as
		| Store<{ requestMember?(guildId: string, userId: string): void }>
		| undefined
	store?.requestMember?.(guildId, userId)
}

export function getMember(
	guildId: string | null | undefined,
	userId: string | null | undefined,
) {
	if (!guildId || !userId) return
	return getGuildMemberStore().getMember(guildId, userId) ?? undefined
}

export function getMemberColors(
	guildId: string | null | undefined,
	userId: string | null | undefined,
) {
	return getColors(guildId, getMember(guildId, userId))
}

export function getSelectedGuildId() {
	return getSelectedGuildStore().getGuildId() || undefined
}

export function getRoles(guildId: string): Role[] {
	const store = getGuildRoleStore()
	return (
		store?.getSortedRoles?.(guildId) ??
		Object.values(store?.getRolesSnapshot?.(guildId) ?? {})
	)
}

/**
 * Parses a hex color string to an RGB integer, the format Discord uses for role colors.
 */
export function hexToInt(hex: string) {
	return Number.parseInt(hex.slice(1, 7), 16)
}
