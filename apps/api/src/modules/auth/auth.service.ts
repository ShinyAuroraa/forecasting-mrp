import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!user || !user.ativo) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.senhaHash);
    if (!isPasswordValid) {
      return null;
    }

    return { id: user.id, email: user.email, nome: user.nome, role: user.role };
  }

  async login(user: { id: string; email: string; role: string }) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        ativo: true,
        refreshTokenHash: true,
      },
    });

    if (!user || !user.ativo || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    if (tokenHash !== user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    const newRefreshTokenHash = this.hashRefreshToken(newRefreshToken);
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string) {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  private generateAccessToken(user: {
    id: string;
    email: string;
    role: string;
  }): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: process.env['JWT_EXPIRES_IN'] || '1h' },
    );
  }

  private generateRefreshToken(user: {
    id: string;
    email: string;
  }): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d' },
    );
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
