from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (26, 115, 232, 255))
    draw = ImageDraw.Draw(img)
    
    padding = size // 8
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=size // 8,
        fill=(255, 255, 255, 255)
    )
    
    text = "XQ"
    try:
        font_size = size // 3
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - size // 20
    
    draw.text((x, y), text, fill=(26, 115, 232, 255), font=font)
    
    img.save(filename)
    print(f"Created {filename}")

if __name__ == "__main__":
    create_icon(16, "icon16.png")
    create_icon(48, "icon48.png")
    create_icon(128, "icon128.png")
    print("All icons created successfully!")
