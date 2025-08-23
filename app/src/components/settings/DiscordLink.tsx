import { Box, Link, Typography } from '@mui/material';
import discordIcon from './discord.svg';

export default function DiscordLink() {
  const discordInviteLink = 'https://discord.gg/JpArXnBgEj';

  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
        Join Our Community
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Get help, share tips, request features, and connect with other Free
        Sleep users
      </Typography>
      <Link
        href={discordInviteLink}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ textDecoration: 'none' }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            '&:hover img': { transform: 'scale(1.05)' },
          }}
        >
          <img
            src={discordIcon}
            alt="Join our Discord community"
            width={80}
            height={80}
            style={{ transition: 'transform 0.2s ease-in-out' }}
          />
          <Typography variant="body1" sx={{ mt: 1, fontWeight: 500 }}>
            Join Discord Community
          </Typography>
        </Box>
      </Link>
    </Box>
  );
}
