import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Brakuje zmiennych środowiskowych DISCORD_TOKEN lub CLIENT_ID.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('graj')
    .setDescription('Odtwarza muzykę z podanego linku (YouTube, SoundCloud itd.).')
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('Link do utworu / playlisty')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('graj-plik')
    .setDescription('Odtwarza wgrany plik muzyczny.')
    .addAttachmentOption(option =>
      option
        .setName('plik')
        .setDescription('Plik audio (MP3, OGG, WEBM, WAV, FLAC, M4A)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Zatrzymuje odtwarzanie i wylogowuje bota z kanału głosowego.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  try {
    console.log('Rozpoczynam rejestrowanie komend (slash)...');

    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log('Pomyślnie zarejestrowano komendy dla serwera o ID:', guildId);
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('Pomyślnie zarejestrowano komendy globalnie.');
    }
  } catch (error) {
    console.error('Błąd podczas rejestrowania komend:', error);
  }
}

main();
