import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  getVoiceConnection
} from '@discordjs/voice';
import play from 'play-dl';
import fetch from 'node-fetch';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Brak zmiennej środowiskowej DISCORD_TOKEN. Ustaw ją w pliku .env.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Prosty storage: player na każdy serwer (guild)
const guildPlayers = new Map(); // guildId -> { connection, player }

function getOrCreatePlayer(interaction) {
  const guildId = interaction.guild.id;
  let data = guildPlayers.get(guildId);

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    throw new Error('Użytkownik nie jest na żadnym kanale głosowym.');
  }

  if (!data || !data.connection || data.connection.state.status === 'destroyed') {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      // Po zakończeniu utworu nic nie robimy – bot zostaje na kanale.
    });

    player.on('error', error => {
      console.error('Błąd odtwarzacza:', error);
    });

    data = { connection, player };
    guildPlayers.set(guildId, data);
  }

  return data;
}

async function playFromUrl(interaction, url) {
  await interaction.deferReply();

  try {
    const { connection, player } = getOrCreatePlayer(interaction);

    if (!play.is_valid_url(url)) {
      await interaction.editReply('Ten link wygląda na nieprawidłowy. Upewnij się, że podałeś poprawny URL.');
      return;
    }

    const info = await play.video_basic_info(url).catch(() => null);

    const stream = await play.stream(url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    player.play(resource);

    const title = info?.video_details?.title || 'Nieznany tytuł';
    await interaction.editReply(`▶️ Odtwarzam: **${title}**`);
  } catch (error) {
    console.error('Błąd przy odtwarzaniu z URL:', error);
    await interaction.editReply('Wystąpił błąd podczas próby odtworzenia tego linku.');
  }
}

async function playFromAttachment(interaction, attachment) {
  await interaction.deferReply();

  try {
    const { player } = getOrCreatePlayer(interaction);

    // Prosta walidacja formatu
    const allowedExtensions = ['.mp3', '.ogg', '.webm', '.wav', '.flac', '.m4a'];
    const name = attachment.name?.toLowerCase() || '';
    const hasAllowedExtension = allowedExtensions.some(ext => name.endsWith(ext));

    if (!hasAllowedExtension) {
      await interaction.editReply(
        'Ten typ pliku może nie być obsługiwany. Spróbuj wgrać plik w formacie MP3 / OGG / WEBM / WAV / FLAC / M4A.'
      );
      return;
    }

    const response = await fetch(attachment.url);
    if (!response.ok || !response.body) {
      await interaction.editReply('Nie udało się pobrać pliku z serwerów Discord.');
      return;
    }

    const stream = response.body;
    const resource = createAudioResource(stream);

    player.play(resource);

    await interaction.editReply(`▶️ Odtwarzam plik: **${attachment.name}**`);
  } catch (error) {
    console.error('Błąd przy odtwarzaniu pliku:', error);
    await interaction.editReply('Wystąpił błąd podczas próby odtworzenia wgranego pliku.');
  }
}

async function stopPlayback(interaction) {
  const guildId = interaction.guild.id;
  const data = guildPlayers.get(guildId);

  if (!data) {
    await interaction.reply({ content: 'Bot nie odtwarza teraz żadnej muzyki.', ephemeral: true });
    return;
  }

  const { player, connection } = data;
  try {
    player.stop(true);
    connection.destroy();
  } catch (error) {
    console.error('Błąd przy zatrzymywaniu odtwarzania:', error);
  } finally {
    guildPlayers.delete(guildId);
  }

  await interaction.reply('⏹️ Odtwarzanie zatrzymane, bot opuszcza kanał głosowy.');
}

client.once(Events.ClientReady, (c) => {
  console.log(`Zalogowano jako ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'graj') {
    const url = interaction.options.getString('url', true);

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: 'Musisz być na kanale głosowym, żeby użyć tej komendy.',
        ephemeral: true
      });
      return;
    }

    await playFromUrl(interaction, url);
  }

  if (interaction.commandName === 'graj-plik') {
    const attachment = interaction.options.getAttachment('plik', true);

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: 'Musisz być na kanale głosowym, żeby użyć tej komendy.',
        ephemeral: true
      });
      return;
    }

    await playFromAttachment(interaction, attachment);
  }

  if (interaction.commandName === 'stop') {
    await stopPlayback(interaction);
  }
});

client.login(token);
