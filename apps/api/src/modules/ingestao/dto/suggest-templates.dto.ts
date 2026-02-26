import { IsArray, IsString, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class SuggestTemplatesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  headers!: string[];
}
