const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const http = require('http');
const { QuickDB } = require("quick.db");
const db = new QuickDB();
require('dotenv').config();

// Servidor HTTP para a Render
http.createServer((req, res) => {
    res.write("Bot Cloner VIP Pro Online!");
    res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildPresences
    ]
});

const OWNER_ID = '1225647692458229860'; 

// --- SLASH COMMANDS DEFINITION ---
const commands = [
    new SlashCommandBuilder()
        .setName('addvip')
        .setDescription('👑 [DONO] Adiciona um usuário ao VIP.')
        .addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true))
        .addIntegerOption(o => o.setName('dias').setDescription('Dias (0=Permanente)').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('delvip')
        .setDescription('❌ [DONO] Remove um usuário do VIP.')
        .addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)),

    new SlashCommandBuilder()
        .setName('painel')
        .setDescription('📊 [DONO] Lista de clientes VIP.'),

    new SlashCommandBuilder()
        .setName('tools')
        .setDescription('🛠️ Central de ferramentas VIP.'),

    new SlashCommandBuilder()
        .setName('anunciar')
        .setDescription('📢 [DONO] Envia um anúncio para todos os servidores.')
        .addStringOption(o => o.setName('mensagem').setDescription('Conteúdo do anúncio').setRequired(true)),

    new SlashCommandBuilder()
        .setName('setup_ticket')
        .setDescription('🎫 [DONO] Configura o sistema de tickets VIP.')
        .addChannelOption(o => o.setName('canal').setDescription('Canal onde o painel será enviado').setRequired(true))
        .addChannelOption(o => o.setName('logs').setDescription('Canal de logs dos tickets').setRequired(true)),

    new SlashCommandBuilder()
        .setName('config_bot')
        .setDescription('🎨 [DONO] Personaliza o visual das embeds do bot.')
        .addStringOption(o => o.setName('cor').setDescription('Cor em Hexadecimal (ex: #ff0000)').setRequired(true))
        .addStringOption(o => o.setName('banner').setDescription('URL da imagem do banner').setRequired(false)),

    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('🛡️ [DONO] Ativa ou desativa o sistema Anti-Raid.')
        .addBooleanOption(o => o.setName('status').setDescription('Ativar Anti-Raid?').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`🚀 Bot logado como ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Comandos registrados!');
    } catch (e) { console.error(e); }
});

// --- HELPER FUNCTIONS ---
async function getBotConfig() {
    const config = await db.get('bot_config') || { cor: '#5865F2', banner: null };
    return config;
}

// --- ANTI-RAID LOGIC ---
const joinLog = new Map();
client.on('guildMemberAdd', async (member) => {
    const status = await db.get(`antiraid_${member.guild.id}`);
    if (!status) return;

    const now = Date.now();
    const guildJoins = joinLog.get(member.guild.id) || [];
    const recentJoins = guildJoins.filter(j => now - j < 10000); // Últimos 10 segundos
    recentJoins.push(now);
    joinLog.set(member.guild.id, recentJoins);

    if (recentJoins.length > 5) { // Mais de 5 entradas em 10 segundos
        try {
            await member.guild.setVerificationLevel(4); // Nível máximo de segurança
            const owner = await member.guild.fetchOwner();
            owner.send(`⚠️ **ANTI-RAID ATIVADO:** Muitas entradas detectadas no servidor **${member.guild.name}**. O nível de verificação foi aumentado.`);
        } catch (e) {}
    }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async (interaction) => {
    const config = await getBotConfig();

    if (interaction.isChatInputCommand()) {
        const { commandName, user, options, guild } = interaction;

        // Comandos de Dono
        if (['addvip', 'delvip', 'painel', 'anunciar', 'setup_ticket', 'config_bot', 'antiraid'].includes(commandName) && user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ Acesso negado.', ephemeral: true });
        }

        if (commandName === 'config_bot') {
            const cor = options.getString('cor');
            const banner = options.getString('banner');
            await db.set('bot_config', { cor, banner });
            return interaction.reply(`✅ Visual do bot atualizado! Cor: \`${cor}\``);
        }

        if (commandName === 'antiraid') {
            const status = options.getBoolean('status');
            await db.set(`antiraid_${guild.id}`, status);
            return interaction.reply(`🛡️ Anti-Raid **${status ? 'ATIVADO' : 'DESATIVADO'}** para este servidor.`);
        }

        if (commandName === 'anunciar') {
            const msg = options.getString('mensagem');
            await interaction.reply({ content: '📢 Enviando anúncio...', ephemeral: true });
            let count = 0;
            client.guilds.cache.forEach(g => {
                const channel = g.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(client.user).has(PermissionFlagsBits.SendMessages));
                if (channel) {
                    const embed = new EmbedBuilder().setTitle('📢 Comunicado Oficial').setDescription(msg).setColor(config.cor);
                    if (config.banner) embed.setImage(config.banner);
                    channel.send({ embeds: [embed] }).catch(() => {});
                    count++;
                }
            });
            return interaction.followUp({ content: `✅ Anúncio enviado para ${count} servidores!`, ephemeral: true });
        }

        if (commandName === 'setup_ticket') {
            const canal = options.getChannel('canal');
            const logs = options.getChannel('logs');
            await db.set(`ticket_config_${guild.id}`, { logs: logs.id });

            const embed = new EmbedBuilder()
                .setTitle('🎫 Suporte VIP')
                .setDescription('Clique no botão abaixo para abrir um ticket de suporte exclusivo.')
                .setColor(config.cor);
            if (config.banner) embed.setImage(config.banner);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket').setLabel('Abrir Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
            );

            await canal.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Sistema de tickets configurado!', ephemeral: true });
        }

        // ... (addvip, delvip, painel, tools - lógica anterior mantida)
        if (commandName === 'addvip') {
            const target = options.getUser('usuario');
            const days = options.getInteger('dias');
            const expiresAt = days === 0 ? -1 : Date.now() + (days * 24 * 60 * 60 * 1000);
            await db.set(`vips.${target.id}`, { id: target.id, tag: target.tag, expiresAt });
            return interaction.reply(`✅ **${target.tag}** agora é VIP!`);
        }

        if (commandName === 'painel') {
            const vips = await db.get("vips") || {};
            const list = Object.values(vips).map((v, i) => `**${i+1}.** \`${v.tag}\` - ${v.expiresAt === -1 ? '♾️' : `<t:${Math.floor(v.expiresAt/1000)}:R>`}`).join('\n') || 'Nenhum VIP.';
            const embed = new EmbedBuilder().setTitle('📊 Clientes VIP').setDescription(list).setColor(config.cor);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'tools') {
            const isVip = await db.get(`vips.${user.id}`);
            if (!isVip && user.id !== OWNER_ID) return interaction.reply({ content: '❌ Você não é VIP.', ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle('🛠️ Central VIP')
                .setDescription('Escolha uma ferramenta:')
                .setColor(config.cor);
            if (config.banner) embed.setImage(config.banner);

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_tool')
                    .setPlaceholder('Selecione...')
                    .addOptions([
                        { label: 'Clonar (Via Conta)', value: 'tool_clone_self', emoji: '👤' },
                        { label: 'Clonar (Via Bot)', value: 'tool_clone_bot', emoji: '🤖' },
                        { label: 'Limpar DM', value: 'tool_clear_dm', emoji: '🧹' },
                        { label: 'Auto-Nick', value: 'tool_autonick', emoji: '🏷️' },
                        { label: 'DM All', value: 'tool_dmall', emoji: '📢' },
                    ]),
            );
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    }

    // --- TICKET LOGIC ---
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
        const guild = interaction.guild;
        const user = interaction.user;
        const ticketConfig = await db.get(`ticket_config_${guild.id}`);

        const channel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket Aberto')
            .setDescription(`Olá ${user}, aguarde o suporte. Descreva seu problema abaixo.`)
            .setColor(config.cor);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Ticket criado: ${channel}`, ephemeral: true });

        if (ticketConfig?.logs) {
            const logChan = guild.channels.cache.get(ticketConfig.logs);
            if (logChan) logChan.send(`🎫 **Ticket Aberto:** ${user.tag} criou o canal ${channel.name}`);
        }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        await interaction.reply('🔒 Fechando ticket em 5 segundos...');
        setTimeout(() => channel.delete().catch(() => {}), 5000);
    }

    // ... (Lógica de Modais e Clonagem anterior mantida e adaptada para usar config.cor)
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_tool') {
        const tool = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`modal_${tool}`).setTitle('Configuração');
        const rows = [
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('source').setLabel('ID Origem').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('ID Destino').setStyle(TextInputStyle.Short).setRequired(true))
        ];
        if (tool === 'tool_clone_self') rows.unshift(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token Conta').setStyle(TextInputStyle.Short).setRequired(true)));
        
        if (tool === 'tool_clear_dm') {
            modal.setCustomId('modal_clear_dm').addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel('ID DM').setRequired(true).setStyle(TextInputStyle.Short))
            );
        } else if (tool === 'tool_autonick') {
            modal.setCustomId('modal_autonick').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nickname').setLabel('Novo Nick').setRequired(true).setStyle(TextInputStyle.Short)));
        } else if (tool === 'tool_dmall') {
            modal.setCustomId('modal_dmall').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Mensagem').setRequired(true).setStyle(TextInputStyle.Paragraph)));
        } else {
            modal.addComponents(rows);
        }
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        const { customId, fields, user } = interaction;
        if (customId.startsWith('modal_tool_clone')) {
            const sourceId = fields.getTextInputValue('source');
            const targetId = fields.getTextInputValue('target');
            const token = customId.includes('self') ? fields.getTextInputValue('token') : null;
            
            await interaction.reply({ content: '🔍 Analisando...', ephemeral: true });
            globalCloneData[`key_${user.id}`] = { sourceId, targetId, token, selections: {} };

            const embed = new EmbedBuilder().setTitle('⚙️ O que clonar?').setColor(config.cor);
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('opt_channels').setLabel('Canais').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('opt_roles').setLabel('Cargos').setStyle(ButtonStyle.Secondary),
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_clone').setLabel('INICIAR').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cancel_clone').setLabel('CANCELAR').setStyle(ButtonStyle.Danger),
            );
            await interaction.followUp({ embeds: [embed], components: [row1, row2], ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        const data = globalCloneData[`key_${interaction.user.id}`];
        if (interaction.customId === 'confirm_clone' && data) {
            await interaction.update({ content: '🚀 Clonagem iniciada! Aguarde...', embeds: [], components: [] });
            try {
                let sourceGuild;
                if (data.token) {
                    const self = new SelfClient({ checkUpdate: false });
                    await self.login(data.token);
                    sourceGuild = await self.guilds.fetch(data.sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(data.targetId), data.selections);
                    self.destroy();
                } else {
                    sourceGuild = await client.guilds.fetch(data.sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(data.targetId), data.selections);
                }
                await interaction.followUp({ content: '✅ Clonagem concluída!', ephemeral: true });
            } catch (e) { await interaction.followUp({ content: `❌ Erro: ${e.message}`, ephemeral: true }); }
        }
        if (interaction.customId.startsWith('opt_') && data) {
            const opt = interaction.customId.replace('opt_', '');
            data.selections[opt] = !data.selections[opt];
            await interaction.reply({ content: `✅ Opção ${opt} alterada!`, ephemeral: true });
        }
    }
});

const globalCloneData = {};

async function executeClone(sourceGuild, targetGuild, opts) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    if (opts.roles) {
        const roles = await sourceGuild.roles.fetch();
        for (const role of roles.values()) {
            if (role.name !== '@everyone' && !role.managed) {
                await targetGuild.roles.create({
                    name: role.name,
                    color: role.color,
                    permissions: role.permissions,
                    hoist: role.hoist
                }).catch(() => {});
                await sleep(800);
            }
        }
    }

    if (opts.channels) {
        const oldChannels = await targetGuild.channels.fetch();
        for (const c of oldChannels.values()) { await c.delete().catch(() => {}); await sleep(500); }

        const sChannels = await sourceGuild.channels.fetch();
        const categories = sChannels.filter(c => c.type === ChannelType.GuildCategory);
        const catMap = new Map();

        for (const cat of categories.values()) {
            const newCat = await targetGuild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
            catMap.set(cat.id, newCat.id);
            await sleep(1000);
        }

        for (const chan of sChannels.values()) {
            if (chan.type === ChannelType.GuildCategory) continue;
            await targetGuild.channels.create({
                name: chan.name,
                type: chan.type,
                parent: catMap.get(chan.parentId)
            }).catch(() => {});
            await sleep(1000);
        }
    }
}

client.login(process.env.TOKEN);
