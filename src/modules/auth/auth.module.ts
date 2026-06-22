import { Module } from "@nestjs/common";
import {JwtModule } from "@nestjs/jwt";
//import { UserModule } from "src/user/user.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PrismaService } from "src/services/prisma.service";
import { jwtConstants } from "./constants/constants";
import { PrismaModule } from "src/services/prisma.module";


@Module({
  imports: [
    //UserModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '6000s' },
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
