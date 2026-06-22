import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../services/auth.guard";
import { AuthService } from "./auth.service";
import { Public } from "./constants/constants";
import { GetAuthDto } from "./dto/getAuth.dto";

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() body: GetAuthDto) {
        return this.authService.login(body);
    }
}