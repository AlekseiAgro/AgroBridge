import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { PRODUCT_IMAGE_MAX_BYTES } from '@agrobridge/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  catalog(@Query() query: CatalogQueryDto) {
    return this.productsService.catalog(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.listMine(user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getById(@Param('id') id: string, @Req() req: Request & { user?: AuthenticatedUser }) {
    return this.productsService.getById(id, req.user ?? null);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user, id, dto);
  }

  @Get(':id/watch')
  @UseGuards(JwtAuthGuard)
  getWatch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.productsService.getWatchStatus(user, id);
  }

  @Post(':id/watch')
  @UseGuards(JwtAuthGuard)
  watch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.productsService.watchProduct(user, id);
  }

  @Delete(':id/watch')
  @UseGuards(JwtAuthGuard)
  unwatch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.productsService.unwatchProduct(user, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.productsService.remove(user, id);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES },
    }),
  )
  addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.addImage(user, id, file);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeImage(user, id, imageId);
  }

  @Patch(':id/images/:imageId/primary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  setPrimaryImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.setPrimaryImage(user, id, imageId);
  }
}
